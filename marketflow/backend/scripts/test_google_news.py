import os
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# google-genai 라이브러리 (최신)
try:
    from google import genai
except ImportError:
    print("구글 제미나이 SDK가 설치되어 있지 않습니다. 'pip install google-genai'를 실행하세요.")
    exit(1)

# .env 파일 경로 찾기
# scripts 폴더 기준: scripts -> backend -> marketflow (.env 위치)
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
marketflow_dir = os.path.dirname(backend_dir)
env_path = os.path.join(marketflow_dir, '.env')

load_dotenv(env_path)

def collect_google_news(query, num_articles=5):
    """구글 뉴스 RSS를 활용한 뉴스 수집"""
    print(f"[{query}] 구글 뉴스 수집 중...")
    # hl=ko&gl=KR 로 한국 지역 및 언어 설정
    url = f"https://news.google.com/rss/search?q={query}&hl=ko&gl=KR&ceid=KR:ko"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
    
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        print("뉴스 수집 실패")
        return []
        
    import xml.etree.ElementTree as ET
    
    try:
        root = ET.fromstring(response.content)
        items = root.findall('.//item')
        
        news_list = []
        for item in items[:num_articles]:
            title_node = item.find('title')
            date_node = item.find('pubDate')
            
            title = title_node.text if title_node is not None else ""
            pub_date = date_node.text if date_node is not None else ""
            news_list.append(f"- {title} ({pub_date})")
            
        return news_list
    except ET.ParseError:
        print("RSS 파싱 실패")
        return []

def analyze_with_gemini(news_list, query):
    """Gemini API를 활용한 뉴스 분석"""
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("\n[에러] GOOGLE_API_KEY가 .env 파일에 없습니다!")
        return

    print("[Gemini] 제미나이 모델을 이용해 특징 및 방향성 분석 중...\n")
    try:
        # SDK 초기화
        client = genai.Client(api_key=api_key)
        
        # 모델 선택: 사용자가 요청한 '제미나이 프로 3.1' 사용 (프리뷰 버전)
        model_name = "gemini-2.0-flash" 
        
        prompt = f"""
        다음은 최근 '{query}'와 관련된 구글 뉴스 헤드라인들입니다.
        투자자의 관점에서 이 뉴스들을 분석하여 다음 내용을 리포트 형식으로 작성해주세요:
        
        1. 핵심 요약 (어떤 현안들이 있는지)
        2. 시장에 미치는 영향 (긍정적/부정적 요인)
        3. 단기적 추세 전망

        [수집된 뉴스]
        {chr(10).join(news_list)}
        """
        
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
        )
        
        print("="*60)
        print("[Gemini 분석 결과]")
        print("="*60)
        print(response.text)
        print("="*60)
        
    except Exception as e:
        print(f"[에러] Gemini 분석 중 오류 발생: {e}")

if __name__ == "__main__":
    import sys
    
    # 검색어를 파이썬 실행 인자로 받을 수 있도록 함 (기본값: 테슬라)
    query = sys.argv[1] if len(sys.argv) > 1 else "테슬라"
    
    news_list = collect_google_news(query, num_articles=7)
    
    if news_list:
        print("\n[수집된 뉴스 리스트]")
        for idx, n in enumerate(news_list):
            print(f"{idx+1}. {n}")
        print("\n")
        analyze_with_gemini(news_list, query)
    else:
        print("수집된 뉴스가 없습니다.")
