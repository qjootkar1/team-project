import urllib.request
import json
import sys

print("========================================================")
print("   AccountScope - n8n Webhook Connection Diagnostic")
print("========================================================")
print()

# 1. 포트 확인
test_payload = json.dumps({
    "test": True,
    "year": 2024,
    "sales": "186,000,000원",
    "expense": "118,100,000원",
    "profit": "67,900,000원"
}).encode('utf-8')

urls = [
    ("Production Webhook", "http://localhost:5678/webhook/generate-ai-summary"),
    ("Test Mode Webhook", "http://localhost:5678/webhook-test/generate-ai-summary")
]

any_connected = False

for label, url in urls:
    print(f"[*] Testing {label} ({url})...")
    req = urllib.request.Request(url, data=test_payload, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            body = resp.read().decode('utf-8')
            print(f"    [SUCCESS] HTTP {resp.status} - Response received!")
            print(f"    Payload: {body[:150]}...")
            any_connected = True
            print()
    except urllib.error.HTTPError as e:
        print(f"    [HTTP ERROR] HTTP {e.code}: {e.reason}")
        if e.code == 404:
            if "webhook-test" in url:
                print("    -> n8n 캔버스에서 Webhook 노드의 [Listen for test event]를 클릭하지 않았습니다.")
            else:
                print("    -> n8n 워크플로우 우측 상단의 토글 스위치가 [Active]로 켜져 있지 않습니다.")
        print()
    except Exception as e:
        print(f"    [CONNECTION FAILED] {e}")
        print("    -> n8n 서버(포트: 5678)가 실행 중이지 않습니다.")
        print()

print("========================================================")
if any_connected:
    print("[RESULT] n8n Webhook is WORKING PROPERLY!")
else:
    print("[DIAGNOSIS & SOLUTION]")
    print("1. n8n is NOT running:")
    print("   -> Run 'start_n8n_db.bat' (or run 'npx n8n' in terminal)")
    print("2. If n8n is running in browser, check:")
    print("   -> Toggle workflow to 'Active' at top-right of n8n screen")
    print("   -> If testing in canvas, click 'Listen for test event' on Webhook node")
print("========================================================")
