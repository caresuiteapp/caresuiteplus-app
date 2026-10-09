#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { totalmem, platform } from 'node:os';
import { resolve, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const MIB = 1024 * 1024;
const OWNED_HEADER = '# CareSuite HealthOS GitHub R8 build memory';

export function effectiveMemoryMiB(physicalBytes, cgroupLimits = []) {
  if (!Number.isSafeInteger(physicalBytes) || physicalBytes <= 0) throw new Error('Ungültige Runner-Speichergröße.');
  const limits = [Math.floor(physicalBytes / MIB)];
  for (const text of cgroupLimits) {
    const value = String(text).trim();
    if (/^[1-9]\d*$/.test(value)) limits.push(Number(BigInt(value) / BigInt(MIB)));
    else if (value !== 'max') throw new Error('Ungültige cgroup-Speichergrenze.');
  }
  return Math.min(...limits);
}

export function memoryPlan(memoryMiB) {
  if (!Number.isSafeInteger(memoryMiB) || memoryMiB < 6400) {
    throw new Error('Zu wenig Runner-Speicher für den vollständigen R8-Build (mindestens 6400 MiB erforderlich).');
  }
  const heapMiB = memoryMiB >= 12288 ? 6144 : 4096;
  return {
    schemaVersion: 1,
    effectiveMemoryMiB: memoryMiB,
    heapMiB,
    metaspaceMiB: 1024,
    workers: memoryMiB >= 12288 ? 2 : 1,
    parallelProjects: false,
    jvmArgs: `-Xmx${heapMiB}m -XX:MaxMetaspaceSize=1024m -XX:+UseParallelGC -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8`,
  };
}

function runnerMemoryMiB() {
  const limits = [];
  for (const file of ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']) {
    try { limits.push(readFileSync(file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return effectiveMemoryMiB(totalmem(), limits);
}

const groovyString = value => "'" + value.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', '\\n').replaceAll('\r', '\\r') + "'";

export function writeMemoryConfiguration(gradleUserHome, planFile, plan, commit) {
  if (!isAbsolute(gradleUserHome) || !isAbsolute(planFile)) throw new Error('Absolute Build-Pfade erforderlich.');
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Der genaue GitHub-Quellcommit fehlt.');
  const propertiesFile = join(gradleUserHome, 'gradle.properties');
  if (existsSync(propertiesFile) && !readFileSync(propertiesFile, 'utf8').startsWith(OWNED_HEADER + '\n')) {
    throw new Error('Fremde Gradle-Benutzereinstellungen werden nicht überschrieben.');
  }
  const proofFile = join(resolve(planFile, '..'), 'GRADLE-MEMORY-VERIFIED.json');
  mkdirSync(join(gradleUserHome, 'init.d'), { recursive: true });
  mkdirSync(resolve(planFile, '..'), { recursive: true });
  writeFileSync(propertiesFile, `${OWNED_HEADER}\norg.gradle.jvmargs=${plan.jvmArgs}\norg.gradle.workers.max=${plan.workers}\norg.gradle.parallel=false\n`);
  // This runs inside the real Gradle JVM, before any native compilation. It
  // rejects an ignored memory override immediately rather than after R8 fails.
  writeFileSync(join(gradleUserHome, 'init.d', 'caresuite-healthos-memory.gradle'), `
import java.lang.management.ManagementFactory
import com.sun.management.HotSpotDiagnosticMXBean
import groovy.json.JsonOutput

def vm = ManagementFactory.getPlatformMXBean(HotSpotDiagnosticMXBean)
def heapMiB = vm.getVMOption('MaxHeapSize').value.toLong().intdiv(1048576L)
def metaspaceMiB = vm.getVMOption('MaxMetaspaceSize').value.toLong().intdiv(1048576L)
def parallelGc = vm.getVMOption('UseParallelGC').value == 'true'
def workers = gradle.startParameter.maxWorkerCount
def parallelProjects = gradle.startParameter.parallelProjectExecutionEnabled
if (heapMiB != ${plan.heapMiB} || metaspaceMiB != ${plan.metaspaceMiB} || !parallelGc || workers > ${plan.workers} || parallelProjects) {
    throw new GradleException('CareSuite: Gradle-Speicherbudget nicht wirksam (Heap=' + heapMiB + ' MiB, Metaspace=' + metaspaceMiB + ' MiB, Worker=' + workers + ', Parallel=' + parallelProjects + ').')
}
def proof = [commit: ${groovyString(commit)}, heapMiB: heapMiB, metaspaceMiB: metaspaceMiB, workers: workers, parallelProjects: parallelProjects, parallelGc: parallelGc, javaVersion: System.getProperty('java.version'), gradleVersion: gradle.gradleVersion]
new File(${groovyString(proofFile)}).text = JsonOutput.prettyPrint(JsonOutput.toJson(proof)) + '\\n'
println('CareSuite: Gradle-JVM geprüft, Heap=' + heapMiB + ' MiB, Metaspace=' + metaspaceMiB + ' MiB, Worker=' + workers + ', Parallel=' + parallelProjects + '.')
`);
  const info = { ...plan, commit, gradleUserHome, propertiesFile, proofFile };
  writeFileSync(planFile, JSON.stringify(info, null, 2) + '\n');
  return info;
}

export function verifyMemoryProof(planFile, expectedCommit) {
  const plan = JSON.parse(readFileSync(planFile, 'utf8'));
  const proof = JSON.parse(readFileSync(plan.proofFile, 'utf8'));
  if ((expectedCommit && plan.commit !== expectedCommit) || proof.commit !== plan.commit || proof.heapMiB !== plan.heapMiB || proof.metaspaceMiB !== plan.metaspaceMiB ||
      !Number.isInteger(proof.workers) || proof.workers < 1 || proof.workers > plan.workers || proof.parallelProjects !== false || proof.parallelGc !== true) {
    throw new Error('Der tatsächliche Gradle-Speichernachweis passt nicht zum geprüften Build.');
  }
  return proof;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.env.GITHUB_ACTIONS !== 'true' || platform() !== 'linux') throw new Error('Diese Konfiguration ist ausschließlich für den GitHub-Linux-Runner.');
  if (process.argv[2] === '--verify' && process.argv.length === 4) {
    console.log(JSON.stringify({ status: 'verified', ...verifyMemoryProof(process.argv[3], process.env.GITHUB_SHA) }));
  } else if (process.argv.length === 4) {
    const info = writeMemoryConfiguration(process.argv[2], process.argv[3], memoryPlan(runnerMemoryMiB()), process.env.GITHUB_SHA ?? '');
    console.log(JSON.stringify({ status: 'configured', ...info }, null, 2));
  } else throw new Error('Aufruf: configure-healthos-gradle-memory.mjs GRADLE-ORDNER PLAN.json | --verify PLAN.json');
}
