// AccountScope 로컬 정적 웹 서버 (Node.js 내장 모듈 사용 - 외부 패키지 불필요)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const BASE_DIR = __dirname;
const DEFAULT_PORT = 8000;
const MAX_PORT_ATTEMPTS = 20;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.sql': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8'
};

function openBrowser(url) {
  const startCmd = process.platform === 'win32' ? `start "" "${url}"` :
                   process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(startCmd, (err) => {
    if (err) {
      console.warn(`[알림] 브라우저 자동 실행 실패: ${err.message}`);
    }
  });
}

/**
 * 요청된 URL로부터 실제 서빙할 파일 경로를 탐색 (Clean URLs 지원)
 * 예: /upload -> upload.html, / -> index.html
 */
function resolveFilePath(reqUrl) {
  let cleanUrl = decodeURI(reqUrl.split('?')[0]);
  if (cleanUrl === '/' || cleanUrl === '') cleanUrl = '/index.html';

  let targetPath = path.normalize(path.join(BASE_DIR, cleanUrl));

  // 디렉토리 트래버설 공격 방지
  if (!targetPath.startsWith(BASE_DIR)) return null;

  // 1. 요청 경로에 정확히 파일이 존재하는 경우
  if (fs.existsSync(targetPath)) {
    const stat = fs.statSync(targetPath);
    if (stat.isFile()) return targetPath;
    if (stat.isDirectory()) {
      const indexPath = path.join(targetPath, 'index.html');
      if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
        return indexPath;
      }
    }
  }

  // 2. 확장자가 없는 경우 .html 붙여서 탐색 (예: /upload -> upload.html)
  if (!path.extname(targetPath)) {
    const htmlPath = targetPath + '.html';
    if (fs.existsSync(htmlPath) && fs.statSync(htmlPath).isFile()) {
      return htmlPath;
    }
  }

  // 3. 끝에 슬래시가 있는 경우 제거 후 .html 확인 (예: /upload/ -> upload.html)
  const trimmed = targetPath.replace(/[\\/]+$/, '');
  if (!path.extname(trimmed)) {
    const htmlPath = trimmed + '.html';
    if (fs.existsSync(htmlPath) && fs.statSync(htmlPath).isFile()) {
      return htmlPath;
    }
  }

  return null;
}

function createServer(port, attempt = 0) {
  const server = http.createServer((req, res) => {
    const safePath = resolveFilePath(req.url);

    if (!safePath) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><html><head><meta charset="utf-8"><title>404 Not Found</title></head><body><h2>404 Not Found</h2><p>요청하신 페이지를 찾을 수 없습니다: <code>${req.url}</code></p><p><a href="/index.html">메인 대시보드로 돌아가기</a></p></body></html>`);
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(safePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error');
      }
    });
    stream.pipe(res);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (attempt < MAX_PORT_ATTEMPTS) {
        const nextPort = port === DEFAULT_PORT ? 8080 : port + 1;
        console.log(`[알림] ${port} 포트가 이미 사용 중입니다. ${nextPort} 포트로 전환합니다...`);
        createServer(nextPort, attempt + 1);
      } else {
        console.error(`[오류] 사용 가능한 로컬 포트를 찾지 못했습니다.`);
        process.exit(1);
      }
    } else {
      console.error(`[오류] 서버 실행 중 에러:`, err);
      process.exit(1);
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log('='.repeat(60));
    console.log('  AccountScope 통합 회계 관리 시스템 로컬 서버');
    console.log(`  접속 주소 : ${url}`);
    console.log('  서버 종료 : 이 창에서 Ctrl + C 를 누르세요.');
    console.log('='.repeat(60));

    // 브라우저 자동 실행
    openBrowser(url);
  });
}

createServer(DEFAULT_PORT);
