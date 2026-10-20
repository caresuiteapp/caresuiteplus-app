import crypto from "node:crypto";

const TRACKING_START = "2026-07-31T22:00:00.000Z";

function env() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pin = process.env.CHRISTIAN_TIME_PIN;
  const secret = process.env.CHRISTIAN_TIME_SIGNING_SECRET;
  if (!url || !key || !pin || !secret) throw new Error("CONFIGURATION_MISSING");
  return { url, key, pin, secret };
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a || "")), bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function headers(key, extra = {}) {
  const base = { apikey: key, "Content-Type": "application/json; charset=utf-8" };
  if (!String(key).startsWith("sb_secret_")) base.Authorization = `Bearer ${key}`;
  return { ...base, ...extra };
}
async function db(cfg, path, options = {}) {
  const response = await fetch(`${cfg.url}/rest/v1/${path}`, { ...options, headers: headers(cfg.key, options.headers) });
  const raw = await response.text();
  if (!response.ok) throw new Error(`DATABASE_${response.status}:${raw.slice(0, 800)}`);
  return raw ? JSON.parse(raw) : null;
}
function offset(month) { return month >= 4 && month <= 10 ? "+02:00" : "+01:00"; }
function berlinMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) return null;
  const [year, month] = value.split("-").map(Number);
  if (month < 1 || month > 12) return null;
  const nextYear = month === 12 ? year + 1 : year, nextMonth = month === 12 ? 1 : month + 1;
  const next = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  return { start: `${value}-01T00:00:00${offset(month)}`, end: `${next}-01T00:00:00${offset(nextMonth)}` };
}
function berlinDay() {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const month = Number(day.slice(5, 7));
  return { start: `${day}T00:00:00${offset(month)}`, end: `${day}T23:59:59.999${offset(month)}` };
}
function nextDate(value) {
  const d = new Date(`${value}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function exportRange(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(to || "") || from > to || from < "2026-08-01") return null;
  const end = nextDate(to);
  return { start: `${from}T00:00:00${offset(Number(from.slice(5, 7)))}`, end: `${end}T00:00:00${offset(Number(end.slice(5, 7)))}` };
}
function reason(value) { return typeof value === "string" && value.trim().length >= 5 && value.trim().length <= 500; }
function date(value) { const d = new Date(value); return Number.isFinite(d.getTime()) ? d : null; }
function cleanName(value) { return String(value || "").normalize("NFC").trim(); }
function cleanRemark(value) { return String(value || "").normalize("NFC").trim().slice(0, 2000); }
function meta(req) {
  return { actor: "Christian Reinhardt", ip: String(req.headers["x-forwarded-for"] || "").split(",")[0].slice(0, 64), user_agent: String(req.headers["user-agent"] || "").slice(0, 500) };
}
function location(value) {
  const lat = Number(value?.latitude), lng = Number(value?.longitude), accuracy = Number(value?.accuracy), capturedAt = date(value?.captured_at);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180 || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100000 || !capturedAt) return null;
  if (Math.abs(Date.now() - capturedAt.getTime()) > 5 * 60 * 1000) return null;
  return { lat, lng, accuracy, captured_at: capturedAt.toISOString() };
}
async function activeCategory(cfg, name) {
  const rows = await db(cfg, `christian_worktime_categories?select=id,name&name=eq.${encodeURIComponent(cleanName(name))}&deleted_at=is.null&limit=1`);
  return rows?.[0] || null;
}
async function audit(cfg, id, action, why, before, after, req) {
  await db(cfg, "christian_worktime_audit", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ entry_id: id, action, reason: why.trim(), before_data: before, after_data: after, ...meta(req) }) });
}
function sign(cfg, row, previous) {
  const values = [row.id, row.category, row.started_at, row.ended_at, row.duration_seconds, row.remark || "", row.started_lat ?? "", row.started_lng ?? "", row.started_accuracy_m ?? "", row.started_location_at || "", row.ended_lat ?? "", row.ended_lng ?? "", row.ended_accuracy_m ?? "", row.ended_location_at || "", previous];
  return crypto.createHmac("sha256", cfg.secret).update(values.join("|")).digest("hex");
}

function pdfEscape(value) {
  const cp = { "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133, "†": 134, "‡": 135, "ˆ": 136, "‰": 137, "Š": 138, "‹": 139, "Œ": 140, "Ž": 142, "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151, "˜": 152, "™": 153, "š": 154, "›": 155, "œ": 156, "ž": 158, "Ÿ": 159 };
  let out = "";
  for (const ch of String(value ?? "").normalize("NFC")) {
    const code = cp[ch] ?? ch.charCodeAt(0);
    if (ch === "(" || ch === ")" || ch === "\\") out += `\\${ch}`;
    else if (code >= 32 && code <= 126) out += ch;
    else if (code <= 255) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += "?";
  }
  return out;
}
function wrapText(value, width = 92) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return [""];
  const lines = []; let line = "";
  for (const word of text.split(" ")) {
    if (word.length > width) {
      if (line) { lines.push(line); line = ""; }
      for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width));
    } else if (!line) line = word;
    else if (`${line} ${word}`.length <= width) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}
function buildPdf({ rows, audits, from, to, generatedAt, reportId, datasetHash }) {
  const pages = [[]]; let y = 792;
  const page = () => pages[pages.length - 1];
  const ensure = (height = 14) => { if (y - height < 54) { pages.push([]); y = 792; } };
  const line = (text, { size = 9, bold = false, indent = 0, gap = 12 } = {}) => {
    ensure(gap);
    page().push(`BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${42 + indent} ${y} Tm (${pdfEscape(text)}) Tj ET`);
    y -= gap;
  };
  const wrapped = (text, opts = {}) => { for (const part of wrapText(text, opts.width || 92)) line(part, opts); };
  const rule = () => { ensure(12); page().push(`0.75 w 0.73 0.79 0.88 RG 42 ${y} m 553 ${y} l S`); y -= 12; };
  const fmt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "medium" });
  const duration = seconds => `${Math.floor(Number(seconds || 0) / 3600)} Std. ${String(Math.floor(Number(seconds || 0) % 3600 / 60)).padStart(2, "0")} Min. ${String(Number(seconds || 0) % 60).padStart(2, "0")} Sek.`;
  const loc = (prefix, row) => {
    const lat = row[`${prefix}_lat`], lng = row[`${prefix}_lng`];
    if (lat == null || lng == null) return "nicht erfasst (Altbestand vor R4)";
    return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)} · Genauigkeit ±${Math.round(Number(row[`${prefix}_accuracy_m`] || 0))} m · GPS-Zeit ${fmt.format(new Date(row[`${prefix}_location_at`]))}`;
  };
  const total = rows.filter(r => !r.deleted_at && r.ended_at).reduce((sum, r) => sum + Number(r.duration_seconds || 0), 0);
  const validRows = rows.filter(r => !r.deleted_at && r.ended_at);
  const dayTotals = new Map(), categoryTotals = new Map();
  const dayKey = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
  for (const row of validRows) {
    const day = dayKey.format(new Date(row.started_at));
    dayTotals.set(day, (dayTotals.get(day) || 0) + Number(row.duration_seconds || 0));
    categoryTotals.set(row.category, (categoryTotals.get(row.category) || 0) + Number(row.duration_seconds || 0));
  }

  line("Arbeitszeitnachweis – Christian Reinhardt", { size: 17, bold: true, gap: 22 });
  line("123 Fahrschule Dortmund", { size: 11, bold: true, gap: 18 });
  wrapped("Dokumentation der nicht durch die 123 Fahrschule vergüteten Arbeitsstunden", { size: 10, gap: 14 });
  rule();
  line(`Berichtszeitraum: ${from.split("-").reverse().join(".")} bis ${to.split("-").reverse().join(".")}`, { bold: true });
  line(`Erstellt: ${fmt.format(generatedAt)} · Zeitzone Europe/Berlin`);
  line(`Berichts-ID: ${reportId}`);
  wrapped(`SHA-256-Prüfsumme der exportierten Datengrundlage: ${datasetHash}`, { size: 8, width: 105, gap: 11 });
  line(`Erfasste Nettoarbeitszeit: ${duration(total)}`, { size: 11, bold: true, gap: 18 });
  wrapped("Hinweis zur Beweisführung: Dieser Export dokumentiert die zum Erstellungszeitpunkt gespeicherten Datensätze einschließlich Standortdaten, Bemerkungen, Korrekturkennzeichen und Integritätskette. Die rechtliche Würdigung und Beweiskraft obliegen der jeweils zuständigen Stelle.", { size: 8, width: 110, gap: 11 });
  wrapped("Erfassungsmethode: Beginn und Ende werden serverseitig zeitgestempelt. Die GPS-Koordinaten, der GPS-Zeitpunkt und die Genauigkeit stammen vom jeweiligen Endgerät. Der Export ist keine qualifizierte elektronische Signatur.", { size: 8, width: 110, gap: 11 });
  y -= 6; line("Zusammenfassung", { size: 14, bold: true, gap: 20 });
  line(`Aktive Einträge: ${validRows.length} · Stornierte Einträge: ${rows.filter(r => r.deleted_at).length} · Korrigierte Einträge: ${rows.filter(r => r.edit_reason).length}`);
  line("Tagessummen", { size: 10, bold: true, gap: 15 });
  if (!dayTotals.size) line("Keine anrechenbaren Tagessummen.");
  for (const [day, seconds] of dayTotals) line(`${day}: ${duration(seconds)}`, { indent: 8 });
  line("Summen nach Tätigkeit", { size: 10, bold: true, gap: 15 });
  if (!categoryTotals.size) line("Keine anrechenbaren Tätigkeitssummen.");
  for (const [category, seconds] of [...categoryTotals].sort((a, b) => a[0].localeCompare(b[0], "de"))) wrapped(`${category}: ${duration(seconds)}`, { indent: 8, width: 100 });
  y -= 6; line("Einzelnachweise", { size: 14, bold: true, gap: 20 });
  if (!rows.length) line("Im gewählten Zeitraum liegen keine Einträge vor.");
  rows.forEach((row, index) => {
    ensure(120); rule();
    line(`${index + 1}. ${row.category}${row.deleted_at ? " · STORNIERT" : ""}`, { size: 11, bold: true, gap: 15 });
    line(`Beginn: ${fmt.format(new Date(row.started_at))}`);
    line(`Ende: ${row.ended_at ? fmt.format(new Date(row.ended_at)) : "laufende Erfassung"}`);
    line(`Dauer: ${duration(row.duration_seconds)}`);
    wrapped(`Bemerkung: ${row.remark || "keine Bemerkung"}`, { width: 105, gap: 11 });
    wrapped(`Standort Beginn: ${loc("started", row)}`, { size: 8, width: 112, gap: 11 });
    wrapped(`Standort Ende: ${loc("ended", row)}`, { size: 8, width: 112, gap: 11 });
    if (row.edit_reason) wrapped(`Korrekturgrund: ${row.edit_reason}`, { size: 8, width: 112, gap: 11 });
    if (row.delete_reason) wrapped(`Stornierungsgrund: ${row.delete_reason}`, { size: 8, width: 112, gap: 11 });
    wrapped(`Datensatz-ID: ${row.id}`, { size: 7, width: 125, gap: 10 });
    wrapped(`Integritätswert: ${row.integrity_hash || "nicht vorhanden (Altbestand)"}`, { size: 7, width: 125, gap: 10 });
    wrapped(`Vorheriger Integritätswert: ${row.previous_hash || "GENESIS / nicht vorhanden"}`, { size: 7, width: 125, gap: 10 });
  });
  y -= 8; line("Änderungs- und Stornierungsprotokoll", { size: 14, bold: true, gap: 20 });
  if (!audits.length) line("Für den Zeitraum liegen keine protokollierten Änderungen oder Stornierungen vor.");
  audits.forEach((item, index) => {
    ensure(74); rule();
    line(`${index + 1}. ${item.action} · ${fmt.format(new Date(item.created_at))}`, { bold: true, gap: 14 });
    wrapped(`Grund: ${item.reason || "nicht angegeben"}`, { size: 8, width: 112, gap: 11 });
    wrapped(`Akteur: ${item.actor || "Christian Reinhardt"} · Datensatz-ID: ${item.entry_id}`, { size: 8, width: 112, gap: 11 });
    wrapped(`Technischer Ursprung: IP ${item.ip || "nicht verfügbar"} · Browserkennung ${item.user_agent || "nicht verfügbar"}`, { size: 7, width: 125, gap: 10 });
    wrapped(`Vorher: ${JSON.stringify(item.before_data || {})}`, { size: 6.5, width: 135, gap: 9 });
    wrapped(`Nachher: ${JSON.stringify(item.after_data || {})}`, { size: 6.5, width: 135, gap: 9 });
  });
  const totalPages = pages.length;
  pages.forEach((content, index) => {
    content.push("0.5 w 0.73 0.79 0.88 RG 42 38 m 553 38 l S");
    content.push(`BT /F1 7 Tf 1 0 0 1 42 25 Tm (${pdfEscape(`Berichts-ID ${reportId}`)}) Tj ET`);
    content.push(`BT /F1 7 Tf 1 0 0 1 485 25 Tm (${pdfEscape(`Seite ${index + 1} / ${totalPages}`)}) Tj ET`);
  });
  const objects = [null];
  const add = value => { objects.push(value); return objects.length - 1; };
  const catalogId = add(""), pagesId = add("");
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const boldId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pdfDate = `${generatedAt.toISOString().replace(/\D/g, "").slice(0, 14)}Z`;
  const infoId = add(`<< /Title (${pdfEscape("Arbeitszeitnachweis Christian Reinhardt")}) /Author (${pdfEscape("Christian Reinhardt")}) /Subject (${pdfEscape(`Arbeitszeitdokumentation ${from} bis ${to}`)}) /Keywords (${pdfEscape("Arbeitszeit GPS Integrität Änderungsprotokoll")}) /Creator (CareSuite HealthOS) /Producer (CareSuite HealthOS R4) /CreationDate (D:${pdfDate}) >>`);
  const pageIds = [];
  for (const commands of pages) {
    const stream = commands.join("\n");
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  }
  objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; const offsets = [0];
  for (let i = 1; i < objects.length; i++) { offsets[i] = Buffer.byteLength(pdf, "latin1"); pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}
async function exportPdf(cfg, req, res) {
  const from = String(req.query?.from || ""), to = String(req.query?.to || ""), range = exportRange(from, to);
  if (!range) return res.status(400).json({ error: "INVALID_EXPORT_RANGE" });
  const rows = await db(cfg, `christian_worktime?select=*&started_at=gte.${encodeURIComponent(range.start)}&started_at=lt.${encodeURIComponent(range.end)}&order=started_at.asc`);
  const ids = new Set((rows || []).map(row => row.id));
  let audits = [];
  if (ids.size) {
    const allAudits = await db(cfg, "christian_worktime_audit?select=*&order=created_at.asc");
    audits = (allAudits || []).filter(item => ids.has(item.entry_id));
  }
  const generatedAt = new Date(), canonical = JSON.stringify({ from, to, rows: rows || [], audits: audits || [] });
  const datasetHash = crypto.createHash("sha256").update(canonical).digest("hex");
  const reportId = `CR-${generatedAt.toISOString().replace(/\D/g, "").slice(0, 14)}-${datasetHash.slice(0, 12).toUpperCase()}`;
  const pdf = buildPdf({ rows: rows || [], audits: audits || [], from, to, generatedAt, reportId, datasetHash });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="Arbeitszeitnachweis_Christian_Reinhardt_${from}_${to}.pdf"`);
  res.setHeader("Content-Length", String(pdf.length));
  res.setHeader("X-Report-Id", reportId);
  return res.status(200).end(pdf);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const cfg = env();
    if (!safeEqual(req.headers["x-worktime-pin"], cfg.pin)) return res.status(401).json({ error: "UNAUTHORIZED" });
    if (req.method === "GET" && req.query?.export === "pdf") return exportPdf(cfg, req, res);
    if (req.method === "GET") {
      if (req.query?.ping) return res.status(200).json({ ok: true });
      const month = berlinMonth(String(req.query?.month || ""));
      if (!month) return res.status(400).json({ error: "INVALID_MONTH" });
      const day = berlinDay(), base = "ended_at=not.is.null&deleted_at=is.null";
      const select = "id,category,started_at,ended_at,duration_seconds,remark,started_lat,started_lng,started_accuracy_m,started_location_at,ended_lat,ended_lng,ended_accuracy_m,ended_location_at,integrity_hash,previous_hash,updated_at,edit_reason";
      const [active, records, allRows, dayRows, categories] = await Promise.all([
        db(cfg, "christian_worktime?select=id,category,started_at,started_lat,started_lng,started_accuracy_m,started_location_at&ended_at=is.null&deleted_at=is.null&order=started_at.desc&limit=1"),
        db(cfg, `christian_worktime?select=${select}&${base}&started_at=gte.${encodeURIComponent(month.start)}&started_at=lt.${encodeURIComponent(month.end)}&order=started_at.desc`),
        db(cfg, `christian_worktime?select=duration_seconds&${base}&started_at=gte.${encodeURIComponent(TRACKING_START)}`),
        db(cfg, `christian_worktime?select=duration_seconds&${base}&started_at=gte.${encodeURIComponent(day.start)}&started_at=lte.${encodeURIComponent(day.end)}`),
        db(cfg, "christian_worktime_categories?select=id,name,sort_order&deleted_at=is.null&order=sort_order.asc,name.asc")
      ]);
      const sum = rows => (rows || []).reduce((total, row) => total + Number(row.duration_seconds || 0), 0);
      return res.status(200).json({ active: active?.[0] || null, records: records || [], categories: categories || [], totals: { day: sum(dayRows), month: sum(records), all: sum(allRows), since: "2026-08-01" } });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    if (body.action === "start") {
      const category = cleanName(body.category), geo = location(body.location);
      if (!geo) return res.status(400).json({ error: "LOCATION_REQUIRED" });
      if (!await activeCategory(cfg, category)) return res.status(400).json({ error: "INVALID_CATEGORY" });
      const current = await db(cfg, "christian_worktime?select=id&ended_at=is.null&deleted_at=is.null&limit=1");
      if (current?.length) return res.status(409).json({ error: "ACTIVE_EXISTS" });
      const m = meta(req);
      const rows = await db(cfg, "christian_worktime", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ category, started_ip: m.ip, started_user_agent: m.user_agent, started_lat: geo.lat, started_lng: geo.lng, started_accuracy_m: geo.accuracy, started_location_at: geo.captured_at }) });
      return res.status(201).json({ record: rows[0] });
    }
    if (body.action === "stop") {
      const geo = location(body.location);
      if (!geo) return res.status(400).json({ error: "LOCATION_REQUIRED" });
      const rows = await db(cfg, "christian_worktime?select=*&ended_at=is.null&deleted_at=is.null&order=started_at.desc&limit=1"), row = rows?.[0];
      if (!row) return res.status(409).json({ error: "NO_ACTIVE_RECORD" });
      const ended = new Date(), duration = Math.max(0, Math.floor((ended - new Date(row.started_at)) / 1000));
      const prev = await db(cfg, "christian_worktime?select=integrity_hash&integrity_hash=not.is.null&deleted_at=is.null&order=ended_at.desc&limit=1"), previous = prev?.[0]?.integrity_hash || "GENESIS", m = meta(req);
      const completed = { ...row, ended_at: ended.toISOString(), duration_seconds: duration, remark: cleanRemark(body.remark), ended_lat: geo.lat, ended_lng: geo.lng, ended_accuracy_m: geo.accuracy, ended_location_at: geo.captured_at };
      const updated = await db(cfg, `christian_worktime?id=eq.${encodeURIComponent(row.id)}&ended_at=is.null`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ended_at: completed.ended_at, duration_seconds: duration, remark: completed.remark || null, integrity_hash: sign(cfg, completed, previous), previous_hash: previous, ended_ip: m.ip, ended_user_agent: m.user_agent, ended_lat: geo.lat, ended_lng: geo.lng, ended_accuracy_m: geo.accuracy, ended_location_at: geo.captured_at }) });
      return res.status(200).json({ record: updated?.[0] });
    }
    if (body.action === "edit") {
      const category = cleanName(body.category);
      if (!body.id || !reason(body.reason) || !await activeCategory(cfg, category)) return res.status(400).json({ error: "INVALID_EDIT" });
      const started = date(body.started_at), ended = date(body.ended_at);
      if (!started || !ended || ended <= started || started < new Date(TRACKING_START)) return res.status(400).json({ error: "INVALID_TIME" });
      const found = await db(cfg, `christian_worktime?select=*&id=eq.${encodeURIComponent(body.id)}&ended_at=not.is.null&deleted_at=is.null&limit=1`), before = found?.[0];
      if (!before) return res.status(404).json({ error: "NOT_FOUND" });
      const duration = Math.floor((ended - started) / 1000), after = { ...before, category, started_at: started.toISOString(), ended_at: ended.toISOString(), duration_seconds: duration, remark: cleanRemark(body.remark), updated_at: new Date().toISOString(), edit_reason: body.reason.trim() }, previous = before.integrity_hash || "GENESIS";
      after.integrity_hash = sign(cfg, after, previous);
      const updated = await db(cfg, `christian_worktime?id=eq.${encodeURIComponent(body.id)}&deleted_at=is.null`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ category: after.category, started_at: after.started_at, ended_at: after.ended_at, duration_seconds: duration, remark: after.remark || null, updated_at: after.updated_at, edit_reason: after.edit_reason, previous_hash: previous, integrity_hash: after.integrity_hash }) });
      await audit(cfg, before.id, "EDIT", body.reason, before, updated?.[0] || after, req);
      return res.status(200).json({ record: updated?.[0] });
    }
    if (body.action === "delete") {
      if (!body.id || !reason(body.reason)) return res.status(400).json({ error: "INVALID_DELETE" });
      const found = await db(cfg, `christian_worktime?select=*&id=eq.${encodeURIComponent(body.id)}&ended_at=not.is.null&deleted_at=is.null&limit=1`), before = found?.[0];
      if (!before) return res.status(404).json({ error: "NOT_FOUND" });
      const now = new Date().toISOString();
      const updated = await db(cfg, `christian_worktime?id=eq.${encodeURIComponent(body.id)}&deleted_at=is.null`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ deleted_at: now, delete_reason: body.reason.trim(), updated_at: now }) });
      await audit(cfg, before.id, "DELETE", body.reason, before, updated?.[0] || { ...before, deleted_at: now }, req);
      return res.status(200).json({ ok: true });
    }
    if (body.action === "category_add") {
      const name = cleanName(body.name);
      if (name.length < 2 || name.length > 120) return res.status(400).json({ error: "INVALID_CATEGORY" });
      const rows = await db(cfg, "christian_worktime_categories", { method: "POST", headers: { Prefer: "return=representation,resolution=ignore-duplicates" }, body: JSON.stringify({ name }) });
      return res.status(201).json({ category: rows?.[0] || null });
    }
    if (body.action === "category_edit") {
      const name = cleanName(body.name);
      if (!body.id || name.length < 2 || name.length > 120) return res.status(400).json({ error: "INVALID_CATEGORY" });
      const rows = await db(cfg, `christian_worktime_categories?id=eq.${encodeURIComponent(body.id)}&deleted_at=is.null`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name, updated_at: new Date().toISOString() }) });
      if (!rows?.[0]) return res.status(404).json({ error: "NOT_FOUND" });
      return res.status(200).json({ category: rows[0] });
    }
    if (body.action === "category_delete") {
      if (!body.id) return res.status(400).json({ error: "INVALID_CATEGORY" });
      const now = new Date().toISOString();
      const rows = await db(cfg, `christian_worktime_categories?id=eq.${encodeURIComponent(body.id)}&deleted_at=is.null`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ deleted_at: now, updated_at: now }) });
      if (!rows?.[0]) return res.status(404).json({ error: "NOT_FOUND" });
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "INVALID_ACTION" });
  } catch (error) {
    console.error("christian-worktime", error);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}

export { buildPdf };
