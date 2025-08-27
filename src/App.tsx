import React, { useState, useEffect, useRef } from "react";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, ImageRun } from "docx";
import "./App.css";

interface DraftContent {
  htmlContent: string;
  timestamp: number;
}

const STORAGE_KEY = "draftNote_content";

function App() {
  const [content, setContent] = useState<DraftContent>({
    htmlContent: "",
    timestamp: Date.now(),
  });
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info";
    visible: boolean;
  }>({ message: "", type: "info", visible: false });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // 加载保存的内容
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsedContent = JSON.parse(saved);
        setContent(parsedContent);
        // 初始化编辑器内容
        if (editorRef.current && parsedContent.htmlContent) {
          editorRef.current.innerHTML = parsedContent.htmlContent;
        }
      } catch (error) {
        console.error("Failed to load saved content:", error);
      }
    }
  }, []);

  // 自动保存内容
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
    }, 1000);

    return () => clearTimeout(timer);
  }, [content]);

  // 显示通知
  const showNotification = (
    message: string,
    type: "success" | "error" | "info"
  ) => {
    setNotification({ message, type, visible: true });
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  // 保存光标位置
  const saveCursorPosition = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editorRef.current) {
      const range = selection.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        return {
          startContainer: range.startContainer,
          startOffset: range.startOffset,
          endContainer: range.endContainer,
          endOffset: range.endOffset,
        };
      }
    }
    return null;
  };

  // 恢复光标位置
  const restoreCursorPosition = (position: any) => {
    if (position && editorRef.current) {
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.setStart(position.startContainer, position.startOffset);
        range.setEnd(position.endContainer, position.endOffset);
        selection?.removeAllRanges();
        selection?.addRange(range);
      } catch (error) {
        // 如果恢复失败，将光标设置到末尾
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  };

  // 处理内容变化
  const handleContentChange = () => {
    if (editorRef.current && !isComposing) {
      const cursorPosition = saveCursorPosition();
      setContent((prev) => {
        const newContent = {
          ...prev,
          htmlContent: editorRef.current!.innerHTML,
          timestamp: Date.now(),
        };
        // 使用setTimeout确保状态更新后再恢复光标
        setTimeout(() => {
          restoreCursorPosition(cursorPosition);
        }, 0);
        return newContent;
      });
    }
  };

  // 处理输入法开始
  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  // 处理输入法结束
  const handleCompositionEnd = () => {
    setIsComposing(false);
    // 输入法结束后更新内容
    setTimeout(() => {
      if (editorRef.current) {
        setContent((prev) => ({
          ...prev,
          htmlContent: editorRef.current!.innerHTML,
          timestamp: Date.now(),
        }));
      }
    }, 0);
  };

  // 处理图片粘贴
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    Array.from(items).forEach((item) => {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file && editorRef.current) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            const imageId =
              Date.now().toString() + Math.random().toString(36).substr(2, 9);

            // 获取当前光标位置
            const selection = window.getSelection();
            const range = selection?.getRangeAt(0);

            if (
              range &&
              editorRef.current?.contains(range.commonAncestorContainer)
            ) {
              // 创建图片元素
              const imgWrapper = document.createElement("span");
              imgWrapper.className = "inline-image";
              imgWrapper.setAttribute("data-image-id", imageId);
              imgWrapper.contentEditable = "false";

              const img = document.createElement("img");
              img.src = base64;
              img.alt = `粘贴图片_${new Date().toLocaleTimeString()}`;
              img.style.maxWidth = "100%";
              img.style.height = "auto";
              img.style.display = "inline-block";
              img.style.verticalAlign = "baseline";
              img.style.margin = "2px 4px";
              img.style.borderRadius = "8px";
              img.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";

              const deleteBtn = document.createElement("button");
              deleteBtn.innerHTML = "×";
              deleteBtn.className = "inline-image-delete";
              deleteBtn.style.position = "absolute";
              deleteBtn.style.top = "2px";
              deleteBtn.style.right = "2px";
              deleteBtn.style.background = "rgba(255, 77, 79, 0.9)";
              deleteBtn.style.color = "white";
              deleteBtn.style.border = "none";
              deleteBtn.style.borderRadius = "50%";
              deleteBtn.style.width = "20px";
              deleteBtn.style.height = "20px";
              deleteBtn.style.fontSize = "14px";
              deleteBtn.style.cursor = "pointer";
              deleteBtn.style.display = "flex";
              deleteBtn.style.alignItems = "center";
              deleteBtn.style.justifyContent = "center";
              deleteBtn.style.zIndex = "10";

              deleteBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                imgWrapper.remove();
                handleContentChange();
              };

              imgWrapper.style.position = "relative";
              imgWrapper.style.display = "inline-block";
              imgWrapper.style.margin = "0 2px";
              imgWrapper.appendChild(img);
              imgWrapper.appendChild(deleteBtn);

              // 插入图片到光标位置
              range.deleteContents();
              range.insertNode(imgWrapper);

              // 在图片后面插入一个不可见的零宽度空格，确保可以继续输入
              const textNode = document.createTextNode("\u200B"); // 零宽度空格
              range.setStartAfter(imgWrapper);
              range.insertNode(textNode);

              // 再插入一个普通空格作为输入起点
              const spaceNode = document.createTextNode(" ");
              range.setStartAfter(textNode);
              range.insertNode(spaceNode);

              // 移动光标到普通空格后面
              range.setStartAfter(spaceNode);
              range.collapse(true);
              selection?.removeAllRanges();
              selection?.addRange(range);

              // 确保编辑器获得焦点
              setTimeout(() => {
                editorRef.current?.focus();
              }, 10);

              handleContentChange();
              showNotification("图片已添加", "success");
            }
          };
          reader.readAsDataURL(file);
        }
      }
    });
  };

  // 清空文档
  const handleClear = () => {
    setContent({
      htmlContent: "",
      timestamp: Date.now(),
    });
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
    setShowClearConfirm(false);
    showNotification("文档已清空", "success");
  };

  // 复制全文
  const handleCopyAll = async () => {
    try {
      if (editorRef.current) {
        // 创建临时副本并移除删除按钮
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = editorRef.current.innerHTML;

        // 移除所有删除按钮
        const deleteButtons = tempDiv.querySelectorAll(
          ".inline-image-delete, .image-delete-btn"
        );
        deleteButtons.forEach((btn) => btn.remove());

        // 获取清理后的HTML内容
        const cleanHtmlContent = tempDiv.innerHTML;
        const textContent = editorRef.current.innerText;

        // 使用现代剪贴板API复制HTML和文本
        if (navigator.clipboard && window.ClipboardItem) {
          const clipboardItem = new ClipboardItem({
            "text/html": new Blob([cleanHtmlContent], { type: "text/html" }),
            "text/plain": new Blob([textContent], { type: "text/plain" }),
          });
          await navigator.clipboard.write([clipboardItem]);
          showNotification("内容已复制到剪贴板（包含图片）", "success");
        } else {
          // 降级方案：复制清理后的HTML内容
          await navigator.clipboard.writeText(cleanHtmlContent);
          showNotification("内容已复制到剪贴板", "success");
        }
      }
    } catch (error) {
      // 最终降级方案
      if (editorRef.current) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand("copy");
        selection?.removeAllRanges();
        showNotification("内容已复制到剪贴板", "success");
      } else {
        showNotification("复制失败，请手动选择复制", "error");
      }
    }
  };

  // 导出Word文档
  const handleExportWord = async () => {
    try {
      const children: Paragraph[] = [];

      if (editorRef.current && content.htmlContent) {
        // 创建临时div来解析HTML内容
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = content.htmlContent;

        // 遍历所有子节点
        const processNode = async (node: Node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (text) {
              const lines = text.split("\n");
              lines.forEach((line) => {
                if (line.trim()) {
                  children.push(
                    new Paragraph({
                      children: [new TextRun(line)],
                    })
                  );
                }
              });
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;

            if (element.tagName === "IMG") {
              try {
                const src = element.getAttribute("src");
                if (src && src.startsWith("data:image/")) {
                  // 获取图片的原始尺寸
                  const imgElement = element as HTMLImageElement;
                  const originalWidth =
                    imgElement.naturalWidth || imgElement.width || 400;
                  const originalHeight =
                    imgElement.naturalHeight || imgElement.height || 300;

                  // 计算合适的导出尺寸，保持宽高比
                  const maxWidth = 600; // Word文档最大宽度
                  const maxHeight = 450; // Word文档最大高度

                  let exportWidth = originalWidth;
                  let exportHeight = originalHeight;

                  // 如果图片太大，按比例缩放
                  if (originalWidth > maxWidth || originalHeight > maxHeight) {
                    const widthRatio = maxWidth / originalWidth;
                    const heightRatio = maxHeight / originalHeight;
                    const ratio = Math.min(widthRatio, heightRatio);

                    exportWidth = Math.round(originalWidth * ratio);
                    exportHeight = Math.round(originalHeight * ratio);
                  }

                  // 将base64转换为ArrayBuffer
                  const base64Data = src.split(",")[1];
                  const binaryString = atob(base64Data);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }

                  children.push(
                    new Paragraph({
                      children: [
                        new ImageRun({
                          data: bytes,
                          transformation: {
                            width: exportWidth,
                            height: exportHeight,
                          },
                        }),
                      ],
                    })
                  );
                }
              } catch (error) {
                console.error("Failed to process image:", error);
              }
            } else if (
              element.tagName === "SPAN" &&
              element.classList.contains("inline-image")
            ) {
              // 处理图片容器
              const img = element.querySelector("img");
              if (img) {
                try {
                  const src = img.getAttribute("src");
                  if (src && src.startsWith("data:image/")) {
                    // 获取图片的原始尺寸
                    const imgElement = img as HTMLImageElement;
                    const originalWidth =
                      imgElement.naturalWidth || imgElement.width || 400;
                    const originalHeight =
                      imgElement.naturalHeight || imgElement.height || 300;

                    // 计算合适的导出尺寸，保持宽高比
                    const maxWidth = 600; // Word文档最大宽度
                    const maxHeight = 450; // Word文档最大高度

                    let exportWidth = originalWidth;
                    let exportHeight = originalHeight;

                    // 如果图片太大，按比例缩放
                    if (
                      originalWidth > maxWidth ||
                      originalHeight > maxHeight
                    ) {
                      const widthRatio = maxWidth / originalWidth;
                      const heightRatio = maxHeight / originalHeight;
                      const ratio = Math.min(widthRatio, heightRatio);

                      exportWidth = Math.round(originalWidth * ratio);
                      exportHeight = Math.round(originalHeight * ratio);
                    }

                    // 将base64转换为ArrayBuffer
                    const base64Data = src.split(",")[1];
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                      bytes[i] = binaryString.charCodeAt(i);
                    }

                    children.push(
                      new Paragraph({
                        children: [
                          new ImageRun({
                            data: bytes,
                            transformation: {
                              width: exportWidth,
                              height: exportHeight,
                            },
                          }),
                        ],
                      })
                    );
                  }
                } catch (error) {
                  console.error("Failed to process image:", error);
                }
              }
            } else if (element.tagName === "DIV" || element.tagName === "P") {
              // 处理div和p标签内的内容
              for (const childNode of Array.from(element.childNodes)) {
                await processNode(childNode);
              }
            } else {
              // 处理其他元素的文本内容
              const text = element.textContent?.trim();
              if (text) {
                children.push(
                  new Paragraph({
                    children: [new TextRun(text)],
                  })
                );
              }
            }
          }
        };

        // 处理所有子节点
        for (const childNode of Array.from(tempDiv.childNodes)) {
          await processNode(childNode);
        }
      }

      // 如果没有内容，添加空段落
      if (children.length === 0) {
        children.push(
          new Paragraph({
            children: [new TextRun(" ")],
          })
        );
      }

      const doc = new Document({
        sections: [
          {
            properties: {},
            children,
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `草稿笔记-${new Date().toLocaleDateString()}.docx`);
      showNotification("Word文档导出成功", "success");
    } catch (error) {
      console.error("Export failed:", error);
      showNotification("导出失败，请重试", "error");
    }
  };

  return (
    <div className="app">
      {/* 通知 */}
      {notification.visible && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* 确认对话框 */}
      {showClearConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>确认清空</h3>
            <p>确定要清空所有内容吗？此操作不可撤销。</p>
            <div className="modal-buttons">
              <button
                className="btn btn-secondary"
                onClick={() => setShowClearConfirm(false)}
              >
                取消
              </button>
              <button className="btn btn-danger" onClick={handleClear}>
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="container">
        {/* 标题和功能按钮 */}
        <div className="header-with-buttons">
          <h1 className="app-title">草稿笔记-DraftNote</h1>
          <div className="toolbar">
            <button
              className="btn btn-primary"
              onClick={() => setShowClearConfirm(true)}
              disabled={!content.htmlContent}
            >
              清空内容
            </button>

            <button
              className="btn btn-primary"
              onClick={handleExportWord}
              disabled={!content.htmlContent}
            >
              导出Word
            </button>

            <button
              className="btn btn-primary"
              onClick={handleCopyAll}
              disabled={!content.htmlContent}
            >
              复制全文
            </button>
          </div>
        </div>

        {/* 编辑区域 */}
        <div className="editor-container">
          <div
            ref={editorRef}
            className="rich-editor"
            contentEditable
            suppressContentEditableWarning={true}
            onInput={handleContentChange}
            onPaste={handlePaste}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            data-placeholder="开始输入您的草稿内容...\n\n提示：可以直接粘贴图片到此处（Ctrl+V）"
          />
        </div>

        {/* 底部信息 */}
        <footer className="footer">
          <p>
            内容自动保存到浏览器本地存储 | 字数:{" "}
            {editorRef.current?.innerText?.length || 0} | 图片:{" "}
            {editorRef.current?.querySelectorAll("img")?.length || 0}张
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
