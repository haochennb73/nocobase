/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import fg from 'fast-glob';
import path from 'path';
import ts from 'typescript';

import { ROOT_PATH } from './constant';

const INCLUDE_PATTERNS = ['**/*.{ts,tsx}'];
const EXCLUDE_PATTERNS = [
  '**/fixtures{,/**}',
  '**/demos{,/**}',
  '**/__test__{,/**}',
  '**/__tests__{,/**}',
  '**/__benchmarks__{,/**}',
  '**/__e2e__{,/**}',
  '**/*.mdx',
  '**/*.md',
  '**/*.+(test|e2e|spec).+(js|jsx|ts|tsx)',
  '**/tsconfig{,.*}.json',
  '.umi{,-production,-test}{,/**}',
];

const diagnosticHost: ts.FormatDiagnosticsHost = {
  getCurrentDirectory: () => process.cwd(),
  getCanonicalFileName: (fileName) => (ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase()),
  getNewLine: () => ts.sys.newLine,
};

function loadCompilerOptions(): ts.CompilerOptions {
  const configPath = path.join(ROOT_PATH, 'tsconfig.json');
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext([configFile.error], diagnosticHost));
  }
  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath,
  );
  const options: ts.CompilerOptions = {
    ...parsedConfig.options,
  };
  delete options.paths;
  // Inject aliases for packages without pre-built declarations.
  // Prefer .d.ts (fast) over .ts (slow but always correct).
  const tryInjectAlias = (pkgName: string, ...candidates: string[]) => {
    for (const candidate of candidates) {
      if (ts.sys.fileExists(candidate)) {
        options.paths = { ...(options.paths || {}), [pkgName]: [candidate] };
        return;
      }
    }
  };
  tryInjectAlias(
    '@nocobase/client',
    path.join(ROOT_PATH, 'packages/core/client/src/index.d.ts'),
    path.join(ROOT_PATH, 'packages/core/client/src/index.ts'),
  );
  tryInjectAlias(
    '@nocobase/flow-engine',
    path.join(ROOT_PATH, 'packages/core/flow-engine/src/index.d.ts'),
    path.join(ROOT_PATH, 'packages/core/flow-engine/src/index.ts'),
  );
  return options;
}

function createDeclarationCompilerHost(options: ts.CompilerOptions, declarationDir: string): ts.CompilerHost {
  const host = ts.createCompilerHost(options);
  // Redirect .ts/.tsx → .d.ts when a sibling .d.ts exists (performance: avoids compiling source).
  host.resolveModuleNames = (moduleNames, containingFile, reusedNames, redirectedReference, compilerOptions) => {
    return moduleNames.map((moduleName) => {
      const resolved = ts.resolveModuleName(moduleName, containingFile, compilerOptions, host, undefined, redirectedReference)
        .resolvedModule;
      if (!resolved) {
        return resolved;
      }
      if (/\.(?:cts|mts|ts|tsx)$/.test(resolved.resolvedFileName)) {
        const dtsFile = resolved.resolvedFileName.replace(/\.(?:cts|mts|ts|tsx)$/, '.d.ts');
        if (host.fileExists(dtsFile)) {
          return {
            ...resolved,
            resolvedFileName: dtsFile,
            extension: ts.Extension.Dts,
          };
        }
      }
      return resolved;
    });
  };
  // Only write declarations for the plugin's own files (skip external package files).
  const origWriteFile = host.writeFile;
  host.writeFile = (fileName, data, writeByteOrderMark, onError, sourceFiles) => {
    if (path.normalize(fileName).startsWith(path.normalize(declarationDir) + path.sep)) {
      origWriteFile(fileName, data, writeByteOrderMark, onError, sourceFiles);
    }
  };
  return host;
}

export const buildDeclaration = async (cwd: string, targetDir: string) => {
  const srcPath = path.join(cwd, 'src');
  const targetPath = path.join(cwd, targetDir);
  const files = await fg(INCLUDE_PATTERNS, {
    cwd: srcPath,
    ignore: EXCLUDE_PATTERNS,
    absolute: true,
    dot: true,
  });

  if (!files.length) {
    return;
  }

  const compilerOptions = {
    ...loadCompilerOptions(),
    declaration: true,
    emitDeclarationOnly: true,
    declarationDir: targetPath,
    outDir: targetPath,
    rootDir: srcPath,
  } satisfies ts.CompilerOptions;

  const compilerHost = createDeclarationCompilerHost(compilerOptions, targetPath);
  const program = ts.createProgram(files, compilerOptions, compilerHost);
  const emitResult = program.emit(undefined, undefined, undefined, true);
  const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
  // Only report diagnostics for the plugin's own source files.
  // External package source files (e.g. @nocobase/client/src/**) are included only
  // for type resolution and may have pre-existing errors we don't want to surface.
  const diagnostics = allDiagnostics.filter((d) => {
    if (d.code === 6059) return false; // rootDir violations from external package source
    if (!d.file) return true;
    return d.file.fileName.startsWith(srcPath);
  });

  if (diagnostics.length) {
    const details = ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticHost);
    throw new Error(`Failed to build declarations for ${cwd} \n${details}`);
  }
};
