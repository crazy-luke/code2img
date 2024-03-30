const vscode = require('vscode');
const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');

function activate(context) {
    // 注册命令
    let disposable = vscode.commands.registerCommand('code2img.convertToImage', async function() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor!');
            return;
        }

        const selection = editor.selection;
        const text = editor.document.getText(selection);

        // 确保选中的文本不为空
        if (!text.trim()) {
            vscode.window.showErrorMessage('Selected code is empty!');
            return;
        }

        // 提供风格选择（亮色或暗色）
        const styleOptions = ['Light', 'Dark'];
        const selectedStyle = await vscode.window.showQuickPick(styleOptions, {
            placeHolder: 'Choose a style for the image'
        });

        if (!selectedStyle) {
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Converting code to image...",
            cancellable: false
        }, async(progress) => {
            try {
                const style = selectedStyle.toLowerCase();
                const imgPath = await convertToImage(text, style);
                vscode.window.showInformationMessage(`Image saved to: ${imgPath}`);
            } catch (error) {
                console.error(error);
                vscode.window.showErrorMessage(`Error: ${error.message}`);
            }
        });
    });

    context.subscriptions.push(disposable);
}

/**
 * 根据选中的代码和风格，使用Puppeteer转换为图片
 */
async function convertToImage(code, style) {
    // 应用转义处理
    const escapedCode = escapeHtml(code);

    const browser = await puppeteer.launch(); // 启动Puppeteer
    const page = await browser.newPage(); // 打开一个新页面

    // 设置要渲染的HTML，包含代码和引入的GitHub代码风格CSS
    // 在显示代码的 <pre> 标签中，设置了 style="white-space: pre-wrap;"，这使得即使是较长的代码行也能够被自动换行
    const highlightedCode = `<pre style="white-space: pre-wrap;"><code>${escapedCode}</code></pre>`;
    const htmlContent = `
      <html>
          <head>
              <link rel="stylesheet" href="${style === 'dark' ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.3.1/styles/github-dark.min.css' : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.3.1/styles/github.min.css'}">
              <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.3.1/highlight.min.js"></script>
              <script>hljs.initHighlightingOnLoad();</script>
          </head>
          <body style="margin: 0">${highlightedCode}</body>
      </html>
  `;

    // 设置页面内容
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

    // 动态调整页面大小以适应内容
    const dimensions = await page.evaluate(() => {
        const pre = document.querySelector('pre');
        return {
            width: pre.offsetWidth,
            height: pre.offsetHeight,
        };
    });

    // 设置视窗大小以适应内容
    await page.setViewport({
        width: dimensions.width,
        height: dimensions.height,
        deviceScaleFactor: 2
    });

    // 准备文件路径和名称 
    const downloadsFolderPath = path.join(os.homedir(), 'Downloads');
    const fileName = `code-${Date.now()}.png`;
    const filePath = path.join(downloadsFolderPath, fileName);

    // 生成截图，使用 clip 参数精确控制截图区域
    await page.screenshot({
        path: filePath,
        clip: {
            x: 0,
            y: 0,
            width: dimensions.width,
            height: dimensions.height - 2
        },
        fullPage: false
    });

    await browser.close(); // 关闭浏览器
    return filePath; // 返回文件路径供后续使用
}

function escapeHtml(code) {
    return code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}