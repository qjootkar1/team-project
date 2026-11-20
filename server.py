import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # 정숙 모드: 불필요한 로그 스팸 최소화
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

def main():
    os.chdir(DIRECTORY)
    url = f"http://localhost:{PORT}"
    print("=" * 60)
    print("  AccountScope 통합 회계 관리 시스템 로컬 서버")
    print(f"  접속 주소: {url}")
    print("  종료하려면 이 창에서 Ctrl + C 를 누르세요.")
    print("=" * 60)

    # 기본 브라우저 자동 오픈
    try:
        webbrowser.open(url)
    except Exception:
        pass

    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            httpd.serve_forever()
    except OSError as e:
        if e.errno == 98 or "address already in use" in str(e).lower() or getattr(e, 'winerror', 0) == 10048:
            alt_port = 8080
            print(f"\n[알림] {PORT} 포트가 이미 사용 중이므로 {alt_port} 포트로 재시도합니다.")
            alt_url = f"http://localhost:{alt_port}"
            webbrowser.open(alt_url)
            with socketserver.TCPServer(("", alt_port), Handler) as httpd:
                httpd.serve_forever()
        else:
            raise

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n서버를 정상적으로 종료했습니다.")
