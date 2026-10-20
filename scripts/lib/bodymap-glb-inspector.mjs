const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const TRIANGLES_MODE = 4;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function accessor(gltf, index) {
  return Number.isInteger(index) ? safeArray(gltf.accessors)[index] ?? null : null;
}

function collectBounds(gltf, positionAccessors) {
  const mins = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const maxs = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  let complete = true;

  for (const index of positionAccessors) {
    const entry = accessor(gltf, index);
    if (!entry || !Array.isArray(entry.min) || !Array.isArray(entry.max)) {
      complete = false;
      continue;
    }
    for (let axis = 0; axis < 3; axis += 1) {
      mins[axis] = Math.min(mins[axis], Number(entry.min[axis]));
      maxs[axis] = Math.max(maxs[axis], Number(entry.max[axis]));
    }
  }

  if (!complete || mins.some((value) => !Number.isFinite(value))) return null;
  return {
    min: { x: mins[0], y: mins[1], z: mins[2] },
    max: { x: maxs[0], y: maxs[1], z: maxs[2] },
    dimensions: {
      width: maxs[0] - mins[0],
      height: maxs[1] - mins[1],
      depth: maxs[2] - mins[2],
    },
  };
}

function embeddedResource(uri) {
  return typeof uri === 'string' && uri.startsWith('data:');
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function parseChunks(buffer, errors) {
  const chunks = [];
  let offset = 12;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) {
      errors.push('Unvollständiger GLB-Chunk-Header.');
      break;
    }
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    if (offset + length > buffer.length) {
      errors.push('GLB-Chunk überschreitet die deklarierte Dateilänge.');
      break;
    }
    chunks.push({ type, length, bytes: buffer.subarray(offset, offset + length) });
    offset += length;
  }
  return chunks;
}

export function inspectBodyMapGlb(
  bytes,
  {
    expectedVariantId = null,
    requiredZoneIds = [],
    expectedHeightMeters = null,
    maximumVertices = 250_000,
    maximumTriangles = 500_000,
    maximumFileSizeBytes = 50_000_000,
  } = {},
) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const errors = [];
  const warnings = [];
  if (buffer.length > maximumFileSizeBytes) {
    errors.push(`Dateibudget überschritten: ${buffer.length} > ${maximumFileSizeBytes} Bytes.`);
  }

  if (buffer.length < 20) {
    return {
      valid: false,
      errors: ['Datei ist zu klein für ein gültiges GLB-2.0-Dokument.'],
      warnings,
      stats: null,
      zones: { found: [], missing: [...requiredZoneIds] },
    };
  }

  const magic = buffer.readUInt32LE(0);
  const version = buffer.readUInt32LE(4);
  const declaredLength = buffer.readUInt32LE(8);
  if (magic !== GLB_MAGIC) errors.push('GLB-Magic ist ungültig.');
  if (version !== GLB_VERSION) errors.push(`GLB-Version ${version} wird nicht unterstützt.`);
  if (declaredLength !== buffer.length) {
    errors.push(
      `Deklarierte GLB-Länge ${declaredLength} stimmt nicht mit ${buffer.length} Bytes überein.`,
    );
  }

  const chunks = parseChunks(buffer, errors);
  const jsonChunk = chunks.find((chunk) => chunk.type === JSON_CHUNK);
  const binaryChunks = chunks.filter((chunk) => chunk.type === BIN_CHUNK);
  if (!jsonChunk) errors.push('GLB enthält keinen JSON-Chunk.');
  if (binaryChunks.length !== 1) {
    errors.push(`GLB muss genau einen BIN-Chunk enthalten; gefunden: ${binaryChunks.length}.`);
  }

  let gltf = null;
  if (jsonChunk) {
    try {
      const json = jsonChunk.bytes.toString('utf8').replace(/\u0000+$/g, '').trim();
      gltf = JSON.parse(json);
    } catch (error) {
      errors.push(`GLB-JSON ist ungültig: ${String(error)}`);
    }
  }

  if (!gltf) {
    return {
      valid: false,
      errors,
      warnings,
      stats: null,
      zones: { found: [], missing: [...requiredZoneIds] },
    };
  }

  if (gltf.asset?.version !== '2.0') {
    errors.push(`glTF-Asset-Version muss 2.0 sein; gefunden: ${gltf.asset?.version ?? 'fehlt'}.`);
  }

  const externalBuffers = safeArray(gltf.buffers)
    .map((entry) => entry?.uri)
    .filter((uri) => typeof uri === 'string' && !embeddedResource(uri));
  const externalImages = safeArray(gltf.images)
    .map((entry) => entry?.uri)
    .filter((uri) => typeof uri === 'string' && !embeddedResource(uri));
  if (externalBuffers.length) {
    errors.push(`Externe Buffer sind nicht erlaubt: ${externalBuffers.join(', ')}`);
  }
  if (externalImages.length) {
    errors.push(`Externe Bilddateien sind nicht erlaubt: ${externalImages.join(', ')}`);
  }

  const zoneIds = [];
  for (const node of safeArray(gltf.nodes)) {
    const explicitZone =
      typeof node?.extras?.anatomicalZoneId === 'string'
        ? node.extras.anatomicalZoneId
        : typeof node?.extras?.zoneId === 'string'
          ? node.extras.zoneId
          : null;
    if (explicitZone) zoneIds.push(explicitZone);
    if (typeof node?.name === 'string' && node.name.startsWith('zone__')) {
      zoneIds.push(node.name.slice('zone__'.length));
    }
  }

  let vertices = 0;
  let triangles = 0;
  let primitives = 0;
  let primitivesWithoutNormals = 0;
  let primitivesWithoutUv = 0;
  const positionAccessors = [];
  for (const mesh of safeArray(gltf.meshes)) {
    for (const primitive of safeArray(mesh?.primitives)) {
      primitives += 1;
      const positionIndex = primitive?.attributes?.POSITION;
      const position = accessor(gltf, positionIndex);
      if (position) {
        vertices += Number(position.count ?? 0);
        positionAccessors.push(positionIndex);
      } else {
        errors.push(`Mesh ${mesh?.name ?? '(ohne Namen)'} besitzt keine POSITION-Daten.`);
      }
      if (!Number.isInteger(primitive?.attributes?.NORMAL)) primitivesWithoutNormals += 1;
      if (!Number.isInteger(primitive?.attributes?.TEXCOORD_0)) primitivesWithoutUv += 1;
      if ((primitive?.mode ?? TRIANGLES_MODE) !== TRIANGLES_MODE) {
        errors.push(`Nur Dreiecks-Primitives (mode 4) sind zulässig.`);
      }
      const indexAccessor = accessor(gltf, primitive?.indices);
      triangles += Math.floor(
        Number(indexAccessor?.count ?? position?.count ?? 0) / 3,
      );
    }
  }

  if (primitives === 0) errors.push('GLB enthält keine renderbaren Mesh-Primitives.');
  if (primitivesWithoutNormals) {
    errors.push(`${primitivesWithoutNormals} Primitives besitzen keine Normalen.`);
  }
  if (primitivesWithoutUv) {
    errors.push(`${primitivesWithoutUv} Primitives besitzen keine UV-Koordinaten.`);
  }
  if (vertices > maximumVertices) {
    errors.push(`Vertexbudget überschritten: ${vertices} > ${maximumVertices}.`);
  }
  if (triangles > maximumTriangles) {
    errors.push(`Dreiecksbudget überschritten: ${triangles} > ${maximumTriangles}.`);
  }

  const bounds = collectBounds(gltf, positionAccessors);
  if (!bounds) {
    warnings.push('Abmessungen konnten mangels Accessor-Min/Max nicht geprüft werden.');
  } else {
    const { width, height, depth } = bounds.dimensions;
    if (height <= 0 || width <= 0 || depth <= 0) {
      errors.push('Mesh-Abmessungen müssen auf allen Achsen größer als null sein.');
    }
    if (expectedHeightMeters && Math.abs(height - expectedHeightMeters) > 0.12) {
      errors.push(
        `Körperhöhe ${height.toFixed(3)} m weicht von ${expectedHeightMeters.toFixed(3)} m ab.`,
      );
    }
    if (bounds.min.y < -0.03 || bounds.min.y > 0.03) {
      errors.push(`Bodenursprung liegt bei Y=${bounds.min.y.toFixed(3)} statt bei 0 m.`);
    }
  }

  const metadata = gltf.asset?.extras?.bodymap ?? gltf.extras?.bodymap ?? null;
  if (expectedVariantId && metadata?.variantId !== expectedVariantId) {
    errors.push(
      `GLB-Variant-ID ${metadata?.variantId ?? 'fehlt'} entspricht nicht ${expectedVariantId}.`,
    );
  }
  if (metadata?.units !== 'meters') errors.push('GLB-Metadaten müssen units=meters enthalten.');
  if (metadata?.upAxis !== 'Y') errors.push('GLB-Metadaten müssen upAxis=Y enthalten.');
  if (metadata?.forwardAxis !== 'Z') errors.push('GLB-Metadaten müssen forwardAxis=Z enthalten.');
  if (metadata?.origin !== 'floor-center') {
    errors.push('GLB-Metadaten müssen origin=floor-center enthalten.');
  }
  if (metadata?.meshContractVersion !== 1) {
    errors.push('GLB-Metadaten müssen meshContractVersion=1 enthalten.');
  }

  const foundZones = uniqueSorted(zoneIds);
  const missingZones = requiredZoneIds.filter((zoneId) => !foundZones.includes(zoneId));
  if (missingZones.length) {
    errors.push(`Anatomische Pflichtzonen fehlen: ${missingZones.join(', ')}`);
  }

  const skinMaterials = safeArray(gltf.materials).filter(
    (material) =>
      material?.extras?.bodymapSkinMaterial === true ||
      String(material?.name ?? '').toLowerCase().startsWith('skin'),
  ).length;
  if (skinMaterials === 0) {
    errors.push('Kein eindeutig gekennzeichnetes Hautmaterial gefunden.');
  }

  const stats = {
    bytes: buffer.length,
    chunks: chunks.length,
    scenes: safeArray(gltf.scenes).length,
    nodes: safeArray(gltf.nodes).length,
    meshes: safeArray(gltf.meshes).length,
    primitives,
    vertices,
    triangles,
    materials: safeArray(gltf.materials).length,
    skinMaterials,
    textures: safeArray(gltf.textures).length,
    images: safeArray(gltf.images).length,
    animations: safeArray(gltf.animations).length,
    skins: safeArray(gltf.skins).length,
    morphTargetPrimitives: safeArray(gltf.meshes).reduce(
      (count, mesh) =>
        count +
        safeArray(mesh?.primitives).filter((primitive) => safeArray(primitive?.targets).length)
          .length,
      0,
    ),
    bounds,
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
    metadata,
    zones: { found: foundZones, missing: missingZones },
  };
}

export function formatBodyMapGlbReport(report) {
  const lines = [
    `Status: ${report.valid ? 'BESTANDEN' : 'FEHLGESCHLAGEN'}`,
    `Fehler: ${report.errors.length}`,
    `Warnungen: ${report.warnings.length}`,
  ];
  if (report.stats) {
    lines.push(
      `Vertices: ${report.stats.vertices}`,
      `Dreiecke: ${report.stats.triangles}`,
      `Meshes/Primitives: ${report.stats.meshes}/${report.stats.primitives}`,
      `Zonen: ${report.zones.found.length}`,
    );
  }
  for (const error of report.errors) lines.push(`FEHLER: ${error}`);
  for (const warning of report.warnings) lines.push(`WARNUNG: ${warning}`);
  return lines.join('\n');
}
