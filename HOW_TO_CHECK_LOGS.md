# 서버 로그 확인 방법

## 1. 개발 서버가 실행 중인지 확인

개발 서버가 실행 중이어야 서버 로그를 볼 수 있습니다.

### 서버 실행 방법:
터미널(또는 Cursor 하단의 터미널 탭)에서 다음 명령어를 실행하세요:

```bash
npm run dev
```

## 2. 서버 로그 위치

서버 로그는 **개발 서버가 실행 중인 터미널 창**에서 확인할 수 있습니다.

## 3. 엑셀 다운로드 시 확인할 로그

관리자 페이지에서 엑셀 다운로드를 실행하면, 터미널에서 다음과 같은 로그를 볼 수 있습니다:

```
[Export] 🔄 Fetching responses for survey ...
[Export] Request timestamp: ...
[DB] getResponsesBySurvey - Found X responses
[DB] getResponsesBySurvey - Latest response: {...}
[Export] Latest response in fetched data: {...}
[Export] 📊 Excel Summary: {
  totalResponses: X,
  latestDate: "2025-12-04 ...",
  oldestDate: "...",
}
[Export] ⏰ Latest response date in Excel: ...
```

## 4. 확인해야 할 중요한 정보

### 최신 응답 날짜 확인
- `[DB] getResponsesBySurvey - Latest response` 로그에서 `submittedAt` 값을 확인
- `[Export] ⏰ Latest response date in Excel` 로그에서 엑셀에 포함된 최신 날짜 확인

### 응답 수 확인
- `[DB] getResponsesBySurvey - Found X responses` - Supabase에서 가져온 총 응답 수
- `[Export] 📊 Excel Summary` - 엑셀에 포함된 총 응답 수

## 5. 문제 해결

### 서버 로그가 보이지 않는 경우:
1. 개발 서버가 실행 중인지 확인 (`npm run dev`)
2. 터미널 창을 찾아서 스크롤하여 확인
3. 엑셀 다운로드를 다시 시도

### 로그가 너무 많은 경우:
터미널에서 `[Export]` 또는 `[DB]`로 검색하면 관련 로그만 필터링할 수 있습니다.

