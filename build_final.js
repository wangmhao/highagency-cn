const fs = require('fs-extra');
const MarkdownIt = require('markdown-it');
const cheerio = require('cheerio');

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

// Helper for English detection
function isEnglish(text) {
  if (!text) return false;
  return !/[\u4e00-\u9fa5]/.test(text);
}

const defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options);
};
md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  tokens[idx].attrPush(['target', '_blank']);
  tokens[idx].attrPush(['rel', 'noopener noreferrer']);
  return defaultRender(tokens, idx, options, env, self);
};

async function buildFinal() {
  console.log('Building Final Site...');

  try {
    const markdown = await fs.readFile('final_cn.md', 'utf-8');
    const sourceMarkdown = await fs.readFile('High Agency What It Is, How to Get It, and Why It Matters 高能动性：是什么，如何获得，以及为什么重要.md', 'utf-8');
    const css = await fs.readFile('style_replica.css', 'utf-8');

    // 1. Prepare English Headers from Source
    const sourceHtml = md.render(sourceMarkdown);
    const $source = cheerio.load(sourceHtml);
    const englishHeaders = [];

    $source('h1, h2, h3').each((i, el) => {
        const text = $source(el).text().trim();
        if (isEnglish(text)) {
            englishHeaders.push({
                tag: el.tagName.toLowerCase(),
                text: text,
                html: $source(el).html()
            });
        }
    });
    console.log(`Found ${englishHeaders.length} English headers.`);

    // 2. Render Target (Chinese)
    const contentHtml = md.render(markdown);
    const $ = cheerio.load(contentHtml);

    // 3. Inject English Headers (Best Effort)
    let headerCursor = 0;
    $('h1, h2, h3').each((i, el) => {
        const $el = $(el);
        const tag = el.tagName.toLowerCase();

        // Find next matching header in English list
        let match = null;
        for(let j=0; j<10; j++) {
            if (headerCursor + j >= englishHeaders.length) break;
            if (englishHeaders[headerCursor + j].tag === tag) {
                match = englishHeaders[headerCursor + j];
                headerCursor = headerCursor + j + 1;
                break;
            }
        }

        if (match) {
            // Inject!
            $el.before(`<${match.tag} class="english-content header-en">${match.html}</${match.tag}>`);
        }
    });

    // 4. Handle YouTube/X Links
    $('a').each(function() {
        const href = $(this).attr('href');
        if (!href) return;

        if (href.includes('youtube.com') || href.includes('youtu.be')) {
             $(this).replaceWith(`<span class="video-placeholder" data-url="${href}"> [YouTube视频: 点击跳转观看] </span>`);
        } else if (href.includes('twitter.com') || href.includes('x.com')) {
             $(this).replaceWith(`<span class="social-placeholder" data-url="${href}"> [X/Twitter推文: 点击跳转查看] </span>`);
        }
    });

    // 5. Image Notes/Captions (Heuristic)
    // User said "Notes below images".
    // We assume if a <p> follows an image <p>, and text starts with '>', it might be a note.
    // Or just simple text.
    // Let's add a class to all paragraphs following images to allow CSS styling if needed.
    // Actually, user said "show them". They are shown by default.
    // We just ensure they look okay.

    // 6. Sidebar TOC
    const tocItems = [];
    // We want to link to the CHINESE headers, which are the ones in the document flow.
    // The English ones are injected before them.
    $('h1, h2, h3').not('.english-content').each(function(i, el) {
        const text = $(this).text().trim();
        if (!text) return;
        const tagName = el.tagName.toLowerCase();
        const id = `section-${i}`;

        // If English header was injected before, it's a separate element.
        // We ID the Chinese one.
        $(this).attr('id', id);

        tocItems.push({ text, id, level: tagName });
    });

    let sidebarHtml = `
      <div class="sidebar">
        <div class="logo-area">
          <img src="https://cdn.prod.website-files.com/67891452634f936deafd719a/678918facdf82c05770d9983_https%253A%252F%252Fsubstack-post-media.s3.amazonaws.com%252Fpublic%252Fimages%252F65ec8a5a-93a2-4344-a8a3-0331170d543f_964x544.avif" class="logo-img" alt="Logo">
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

    // 7. Assemble
    const processedContent = $('body').html();
    const finalHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>High Agency: 高能动性 (中文精译版)</title>
  <style>
    ${css}
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
    .english-content {
      display: none;
      color: #888;
      font-family: "Inter", sans-serif;
    }
    .header-en {
        margin-bottom: 5px !important;
        margin-top: 2em !important;
        border-bottom: none !important;
        font-size: 0.8em !important;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    body.show-english .english-content {
        display: block;
    }
    /* Toggle Switch */
    .toggle-wrapper {
        position: fixed; top: 20px; right: 30px; z-index: 1000;
        background: var(--bg-color); border: 1px solid rgba(0,0,0,0.1);
        padding: 8px 16px; border-radius: 30px; display: flex; align-items: center; gap: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .switch { position: relative; display: inline-block; width: 40px; height: 20px; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 20px; }
    .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
    input:checked + .slider { background-color: #000; }
    input:checked + .slider:before { transform: translateX(20px); }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/pangu@4.0.7/dist/browser/pangu.min.js"></script>
</head>
<body>
  <div class="toggle-wrapper" onclick="toggleEnglish()">
    <span style="font-size: 0.8rem; font-weight: 600;">EN / 中文</span>
    <label class="switch">
      <input type="checkbox" id="englishToggle">
      <span class="slider"></span>
    </label>
  </div>

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
      pangu.spacingElementByClassName('article-container');

      document.querySelectorAll('.video-placeholder, .social-placeholder').forEach(el => {
        el.addEventListener('click', (e) => {
          const url = el.getAttribute('data-url');
          if(confirm('即将跳转至外部链接，是否继续？')) {
            window.open(url, '_blank');
          }
        });
      });
    });

    function toggleEnglish() {
      const body = document.body;
      const checkbox = document.getElementById('englishToggle');
      if (event.target !== checkbox && !event.target.classList.contains('slider')) checkbox.checked = !checkbox.checked;
      if (checkbox.checked) body.classList.add('show-english');
      else body.classList.remove('show-english');
    }
  </script>
</body>
</html>`;

    await fs.writeFile('index.html', finalHtml);
    console.log('Successfully built index.html');

  } catch (error) {
    console.error('Build failed:', error);
  }
}

buildFinal();
