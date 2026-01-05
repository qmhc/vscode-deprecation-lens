import { existsSync, readFileSync } from 'node:fs'

import { dirname } from 'node:path'

import * as vscode from 'vscode'
import ts from 'typescript'

import { isJsOrTsFile } from './utils'

/** Deprecated 相关的诊断码 */
const DEPRECATED_DIAGNOSTIC_CODES = new Set([
  6385, // '{0}' is deprecated.
  6386, // '{0}' is deprecated. Use '{1}' instead.
  6387, // The signature '{0}' is deprecated.
])

/**
 * 诊断上报器
 * 监听打开的文件，扫描 deprecated 使用并上报到 Problems 面板
 */
export class DiagnosticsReporter implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection
  private disposables: vscode.Disposable[] = []

  /** 文件对应的 LanguageService 缓存 */
  private serviceCache = new Map<
    string,
    {
      service: ts.LanguageService,
      files: Map<string, { version: number, content: string }>,
    }
  >()

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('deprecation-lens')

    // 监听文档打开
    this.disposables.push(vscode.workspace.onDidOpenTextDocument(doc => this.analyzeDocument(doc)))

    // 监听文档修改
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(e => this.analyzeDocument(e.document)),
    )

    // 监听文档关闭，清理诊断
    this.disposables.push(
      vscode.workspace.onDidCloseTextDocument(doc => {
        this.diagnosticCollection.delete(doc.uri)
      }),
    )

    // 分析当前已打开的文档
    for (const doc of vscode.workspace.textDocuments) {
      this.analyzeDocument(doc)
    }
  }

  /**
   * 分析文档中的 deprecated 使用
   */
  private analyzeDocument(document: vscode.TextDocument): void {
    if (!isJsOrTsFile(document.fileName)) {
      return
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri)
    if (!workspaceFolder) {
      return
    }

    try {
      const diagnostics = this.getDeprecatedDiagnostics(document, workspaceFolder)
      this.diagnosticCollection.set(document.uri, diagnostics)
    } catch (error) {
      console.error('[Deprecation Lens] Error analyzing document:', error)
    }
  }

  /**
   * 获取文件的 deprecated 诊断
   */
  private getDeprecatedDiagnostics(
    document: vscode.TextDocument,
    workspaceFolder: vscode.WorkspaceFolder,
  ): vscode.Diagnostic[] {
    const rootPath = workspaceFolder.uri.fsPath
    const cacheKey = rootPath

    // 获取或创建 LanguageService
    let cached = this.serviceCache.get(cacheKey)
    if (!cached) {
      cached = this.createLanguageService(rootPath)
      if (!cached) return []
      this.serviceCache.set(cacheKey, cached)
    }

    const { service, files } = cached
    const fileName = document.uri.fsPath

    // 更新文件内容
    const existing = files.get(fileName)
    const newVersion = (existing?.version ?? 0) + 1
    files.set(fileName, { version: newVersion, content: document.getText() })

    // 获取 deprecated 诊断
    const tsDiagnostics = service.getSuggestionDiagnostics(fileName)
    const deprecatedDiags = tsDiagnostics.filter(
      d => d.code && DEPRECATED_DIAGNOSTIC_CODES.has(d.code),
    )

    return deprecatedDiags.map(diag => {
      const start = diag.start ?? 0
      const length = diag.length ?? 0
      const sourceFile = service.getProgram()?.getSourceFile(fileName)

      let range: vscode.Range
      if (sourceFile) {
        const startPos = ts.getLineAndCharacterOfPosition(sourceFile, start)
        const endPos = ts.getLineAndCharacterOfPosition(sourceFile, start + length)
        range = new vscode.Range(
          new vscode.Position(startPos.line, startPos.character),
          new vscode.Position(endPos.line, endPos.character),
        )
      } else {
        range = new vscode.Range(0, 0, 0, 0)
      }

      const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n')
      const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning)
      diagnostic.source = 'Deprecation Lens'
      diagnostic.tags = [vscode.DiagnosticTag.Deprecated]

      return diagnostic
    })
  }

  /**
   * 创建 TypeScript LanguageService
   */
  private createLanguageService(rootPath: string):
    | {
      service: ts.LanguageService,
      files: Map<string, { version: number, content: string }>,
    }
    | undefined {
    const configPath = ts.findConfigFile(rootPath, ts.sys.fileExists, 'tsconfig.json')
    if (!configPath) return undefined

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
    if (configFile.error) return undefined

    const configDir = dirname(configPath)
    const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, configDir)
    if (parsedConfig.errors.length > 0) return undefined

    const files = new Map<string, { version: number, content: string }>()

    const serviceHost: ts.LanguageServiceHost = {
      getScriptFileNames: () => parsedConfig.fileNames,
      getScriptVersion: fileName => {
        const file = files.get(fileName)
        return file ? file.version.toString() : '0'
      },
      getScriptSnapshot: fileName => {
        const cached = files.get(fileName)
        if (cached) {
          return ts.ScriptSnapshot.fromString(cached.content)
        }
        if (!existsSync(fileName)) return undefined
        const content = readFileSync(fileName, 'utf-8')
        files.set(fileName, { version: 0, content })
        return ts.ScriptSnapshot.fromString(content)
      },
      getCurrentDirectory: () => configDir,
      getCompilationSettings: () => parsedConfig.options,
      getDefaultLibFileName: ts.getDefaultLibFilePath,
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
    }

    const service = ts.createLanguageService(serviceHost, ts.createDocumentRegistry())
    return { service, files }
  }

  dispose(): void {
    this.diagnosticCollection.dispose()
    for (const { service } of this.serviceCache.values()) {
      service.dispose()
    }
    this.serviceCache.clear()
    for (const d of this.disposables) {
      d.dispose()
    }
  }
}
