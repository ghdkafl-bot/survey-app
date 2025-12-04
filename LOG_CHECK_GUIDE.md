# 서버 로그 확인 가이드

## 실제 로그 확인 방법

### 1. 개발 서버 확인
개발 서버가 실행 중이어야 로그를 볼 수 있습니다.

### 2. 실제 로그 확인 단계

1. **개발 서버 실행 확인**
   - Cursor 하단의 "터미널" 탭을 확인하세요
   - `npm run dev`가 실행 중인지 확인하세요
   - 실행 중이 아니라면 실행하세요

2. **엑셀 다운로드 실행**
   - 관리자 페이지에서 "Excel 다운로드" 버튼을 클릭하세요

3. **로그 확인**
   - 터미널에서 자동으로 나타나는 로그를 확인하세요
   - 로그는 자동으로 나타납니다 (직접 입력할 필요 없습니다)

### 3. 확인할 로그 내용

엑셀 다운로드를 실행하면 터미널에 다음과 같은 로그가 **자동으로** 나타납니다:

```
[Export] 🔄 Fetching responses for survey f9b9e15b-...
[DB] getResponsesBySurvey - Found 5 responses
[DB] getResponsesBySurvey - Latest response: { id: '...', submittedAt: '2025-12-04T...' }
[Export] Latest response in fetched data: { submittedAt: '2025-12-04T...' }
[Export] ⏰ Latest response date in Excel: 2025-12-04T...
```

### 4. 중요한 확인 사항

- `[DB] getResponsesBySurvey - Latest response`의 `submittedAt` 값
- `[Export] ⏰ Latest response date in Excel` 값
- 이 두 값이 Supabase의 최신 응답 날짜와 일치하는지 확인

### 5. 문제 해결

**로그가 보이지 않는 경우:**
1. 개발 서버가 실행 중인지 확인
2. 터미널 탭을 클릭해서 활성화
3. 엑셀 다운로드를 다시 실행

**참고:** 로그는 자동으로 나타나며, 직접 입력할 필요가 없습니다!

