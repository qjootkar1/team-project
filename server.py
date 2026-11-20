import http.server
import socketserver
import webbrowser
import os
import sys
import posixpath
import urllib.parse

PORTS_TO_TRY = [8000, 8080, 8081, 8082, 8088, 3000, 5000]
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # 정숙 모드: 불필요한 로그 스팸 최소화
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

    def translate_path(self, path):
        # Clean URLs 지원: /upload -> upload.html
        path = path.split('?', 1)[0].split('#', 1)[0]
        words = [w for w in posixpath.normpath(urllib.parse.unquote(path)).split('/') if w]
        words_path = os.path.join(DIRECTORY, *words) if words else DIRECTORY

        # 디렉토리인 경우 index.html
        if os.path.isdir(words_path):
            index = os.path.join(words_path, "index.html")
            if os.path.exists(index):
                return index

        # 파일이 정확히 존재하면 반환
        if os.path.exists(words_path) and not os.path.isdir(words_path):
            return words_path

        # 확장자가 없는 경우 .html 붙여서 확인
        if not os.path.splitext(words_path)[1]:
            html_candidate = words_path + ".html"
            if os.path.exists(html_candidate):
                return html_candidate

        return words_path

def run_server():
    os.chdir(DIRECTORY)
    httpd = None
    active_port = None

    for port in PORTS_TO_TRY:
        try:
            httpd = socketserver.TCPServer(("", port), Handler)
            active_port = port
            break
        except OSError as e:
            if getattr(e, 'winerror', 0) == 10048 or e.errno == 98 or "address already in use" in str(e).lower():
                continue
            else:
                raise

    if httpd is None:
        print("[오류] 사용 가능한 로컬 포트(8000~8088 등)를 찾지 못했습니다.")
        sys.exit(1)

    url = f"http://localhost:{active_port}"
    print("=" * 60)
    print("  AccountScope 통합 회계 관리 시스템 로컬 서버")
    print(f"  접속 주소 : {url}")
    print("  종료하려면 이 창에서 Ctrl + C 를 누르세요.")
    print("=" * 60)

    try:
        webbrowser.open(url)
    except Exception:
        pass

    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()

if __name__ == "__main__":
    try:
        run_server()
    except KeyboardInterrupt:
        print("\n서버를 정상적으로 종료했습니다.")
