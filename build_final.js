const fs = require('fs-extra');
const MarkdownIt = require('markdown-it');
const cheerio = require('cheerio');

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

// Link configuration
const defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options);
};
md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  tokens[idx].attrPush(['target', '_blank']);
  tokens[idx].attrPush(['rel', 'noopener noreferrer']);
  return defaultRender(tokens, idx, options, env, self);
};

async function buildFinal() {
  console.log('Building Clean Chinese Version...');

  try {
    const markdown = await fs.readFile('final_cn.md', 'utf-8');
    const css = await fs.readFile('style_replica.css', 'utf-8');

    // 1. Render Markdown
    const contentHtml = md.render(markdown);
    const $ = cheerio.load(contentHtml);

    // 2. Handle YouTube/X Links (Safety Placeholders)
    $('a').each(function() {
        const href = $(this).attr('href');
        if (!href) return;

        if (href.includes('youtube.com') || href.includes('youtu.be')) {
             $(this).replaceWith(`<span class="video-placeholder" data-url="${href}"> [YouTube视频: 点击跳转观看] </span>`);
        } else if (href.includes('twitter.com') || href.includes('x.com')) {
             $(this).replaceWith(`<span class="social-placeholder" data-url="${href}"> [X/Twitter推文: 点击跳转查看] </span>`);
        }
    });

    // 3. Generate Sidebar TOC
    const tocItems = [];
    $('h1, h2, h3').each(function(i, el) {
        const text = $(this).text().trim();
        if (!text) return;
        const tagName = el.tagName.toLowerCase();
        const id = `section-${i}`;

        $(this).attr('id', id);
        tocItems.push({ text, id, level: tagName });
    });

    let sidebarHtml = `
      <div class="sidebar">
        <div class="logo-area">
          <img src="https://cdn.prod.website-files.com/67891452634f936deafd719a/67891452634f936deafd7231_4ki_Rww2_400x400.avif" class="logo-img" alt="Logo">
          <span>HighAgency.cn</span>
        </div>
        <div class="toc-title">目录</div>
        <ul class="toc-list">
    `;
    tocItems.forEach(item => {
        const indentClass = item.level === 'h3' ? 'toc-sub' : 'toc-item';
        sidebarHtml += `<li class="${indentClass}"><a href="#${item.id}" class="toc-link">${item.text}</a></li>`;
    });
    sidebarHtml += `</ul></div>`;

    // 4. Assemble HTML
    const processedContent = $('body').html();
    const finalHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>High Agency: 高能动性 (中文精译版)</title>
  <style>
    ${css}

    /* Embed Placeholders */
    .video-placeholder, .social-placeholder {
      display: inline-block;
      background: #f5f5f5;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.85em;
      color: #666;
      border: 1px solid #ddd;
      cursor: pointer;
      margin: 0 4px;
    }
    .video-placeholder:hover, .social-placeholder:hover {
      background: #eee;
      color: #333;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/pangu@4.0.7/dist/browser/pangu.min.js"></script>
</head>
<body>

  <div class="layout">
    ${sidebarHtml}
    <div class="main-content">
      <div class="article-container">
        ${processedContent}
        <footer style="margin-top:60px; padding-top:20px; border-top:1px solid #eee; color:#888; font-size:0.9em;">
           <p>Original by <a href="https://highagency.com">HighAgency.com</a> | Translated for <a href="https://highagency.cn">HighAgency.cn</a></p>
        </footer>
      </div>
    </div>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      // Auto-spacing for Chinese/English mixed text
      pangu.spacingElementByClassName('article-container');

      // External link confirmation
      document.querySelectorAll('.video-placeholder, .social-placeholder').forEach(el => {
        el.addEventListener('click', (e) => {
          const url = el.getAttribute('data-url');
          if(confirm('即将跳转至外部链接，是否继续？')) {
            window.open(url, '_blank');
          }
        });
      });
    });
  </script>
</body>
</html>`;

    await fs.writeFile('index.html', finalHtml);
    console.log('Successfully built index.html (Clean Chinese Version)');

  } catch (error) {
    console.error('Build failed:', error);
  }
}

buildFinal();
