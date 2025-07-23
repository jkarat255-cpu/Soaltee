// Code editor integration using Monaco Editor
export class CodeEditor {
  constructor() {
    this.editor = null
    this.isInitialized = false
  }

  async initialize(containerId) {
    if (this.isInitialized) return

    try {
      // Load Monaco Editor
      const monaco = require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs" } })

      return new Promise((resolve) => {
        require(["vs/editor/editor.main"], () => {
          this.editor = monaco.editor.create(document.getElementById(containerId), {
            value: "// Write your code here\nfunction solution() {\n    // Your implementation\n    \n}",
            language: "javascript",
            theme: "vs-dark",
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineNumbers: "on",
            roundedSelection: false,
            scrollbar: {
              vertical: "visible",
              horizontal: "visible",
            },
          })

          this.isInitialized = true
          resolve()
        })
      })
    } catch (error) {
      console.error("Error initializing code editor:", error)
    }
  }

  getValue() {
    return this.editor ? this.editor.getValue() : ""
  }

  setValue(code) {
    if (this.editor) {
      this.editor.setValue(code)
    }
  }

  setLanguage(language) {
    if (this.editor) {
      monaco.editor.setModelLanguage(this.editor.getModel(), language)
    }
  }

  runCode() {
    const code = this.getValue()

    try {
      // Create a safe execution environment
      const result = this.executeCode(code)
      return { success: true, output: result }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  executeCode(code) {
    // Simple code execution for demonstration
    // In a real application, you'd want to use a sandboxed environment
    try {
      // Create a function from the code and execute it
      const func = new Function(
        "console",
        `
                const logs = [];
                const mockConsole = {
                    log: (...args) => logs.push(args.join(' ')),
                    error: (...args) => logs.push('ERROR: ' + args.join(' ')),
                    warn: (...args) => logs.push('WARNING: ' + args.join(' '))
                };
                
                ${code}
                
                return logs.join('\\n');
            `,
      )

      const mockConsole = {
        log: () => {},
        error: () => {},
        warn: () => {},
      }

      return func(mockConsole) || "Code executed successfully (no output)"
    } catch (error) {
      throw new Error(`Execution error: ${error.message}`)
    }
  }

  dispose() {
    if (this.editor) {
      this.editor.dispose()
      this.editor = null
      this.isInitialized = false
    }
  }
}

// Global instance
const codeEditor = new CodeEditor()
