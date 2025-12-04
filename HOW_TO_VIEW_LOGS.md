# 개발 서버 로그 확인 가이드

## 1. 개발 서버 실행 확인

### 방법 1: 터미널 탭 확인
1. Cursor 하단의 **"터미널"** 탭을 클릭하세요
2. 여러 터미널이 열려 있을 수 있습니다
3. `npm run dev` 또는 `next dev`가 실행 중인 터미널을 찾으세요

### 방법 2: 개발 서버가 실행 중이 아닌 경우
터미널에서 다음 명령어를 실행하세요:
```bash
npm run dev
```

## 2. 로그 확인 방법

### 단계별 가이드

1. **터미널 탭 열기**
   - Cursor 하단에 있는 "터미널" 탭 클릭
   - 또는 키보드 단축키: `Ctrl + ~` (백틱)

2. **올바른 터미널 찾기**
   - 여러 터미널이 열려 있을 수 있습니다
   - 각 터미널 탭에 제목이 표시됩니다 (예: "Terminal 1", "Terminal 2")
   - `npm run dev` 또는 `next dev`가 실행 중인 터미널을 찾으세요
   - 다음과 같은 메시지가 보여야 합니다:
     ```
     ▲ Next.js 14.2.33
     - Local:        http://localhost:3000
     - Ready in X.Xs
     ```

3. **Excel 다운로드 실행**
   - 브라우저에서 관리자 페이지로 이동
   - "Excel 다운로드" 버튼 클릭

4. **로그 확인**
   - 터미널에 자동으로 로그가 나타납니다
   - 다음과 같은 로그들을 찾으세요:
     ```
     [Export] 🔄 Attempt 1: Calling getResponsesBySurvey at ...
     [DB] getResponsesBySurvey - Found X responses in Supabase query
     [Export] 🔍 Attempt 1 returned X responses
     ```

## 3. 중요한 로그 찾기

Excel 다운로드를 실행하면 다음 로그들이 나타납니다:

### 찾아야 할 로그

1. **재시도 로그**
   ```
   [Export] 🔄 Attempt 1: Calling getResponsesBySurvey at 2025-12-04T...
   [Export] 🔍 Attempt 1 returned 55 responses
   [Export] 🔍 Attempt 1 latest response: { id: '...', date: '2025-12-04T...' }
   ```

2. **데이터베이스 조회 로그**
   ```
   [DB] getResponsesBySurvey - Found 55 responses in Supabase query
   [DB] getResponsesBySurvey - Latest response date in Supabase query: 2025-12-04T...
   ```

3. **최종 결과 로그**
   ```
   [Export] ✅ Final: Using 55 responses (after 7 attempts)
   [Export] ✅ Final latest response date: 2025-12-04T...
   ```

## 4. 로그 복사 방법

### Windows에서 로그 복사하기

1. **터미널에서 텍스트 선택**
   - 마우스로 로그 텍스트를 드래그하여 선택
   - 또는 터미널 우클릭 → "Select All" (모두 선택)

2. **복사**
   - 선택된 텍스트를 우클릭 → "Copy"
   - 또는 `Ctrl + C`

3. **붙여넣기**
   - 메시지 창에 `Ctrl + V`로 붙여넣기

## 5. 문제 해결

### 로그가 보이지 않는 경우

1. **개발 서버가 실행 중인지 확인**
   ```bash
   # 새 터미널을 열고 실행
   npm run dev
   ```

2. **터미널을 스크롤해보세요**
   - 로그가 위로 올라갔을 수 있습니다
   - 터미널을 위로 스크롤하여 이전 로그 확인

3. **터미널을 클리어하지 마세요**
   - `Ctrl + C`로 서버를 중지하면 로그가 사라집니다
   - 서버가 실행 중이어야 로그가 나타납니다

### 로그가 너무 많은 경우

1. **필터링 사용**
   - 터미널에서 `[Export]` 또는 `[DB]`로 검색
   - `Ctrl + F`를 눌러 검색창 열기

2. **Excel 다운로드 직후 로그만 확인**
   - Excel 다운로드 버튼을 클릭한 직후의 로그만 확인
   - 그 전후의 로그는 무시해도 됩니다

## 6. 로그 확인 체크리스트

Excel 다운로드 후 다음 사항을 확인하세요:

- [ ] `[Export] 🔄 Attempt X` 로그가 7번 나타나는가?
- [ ] 각 시도마다 몇 개의 응답이 조회되는가? (예: `returned 55 responses`)
- [ ] `[DB] getResponsesBySurvey - Found X responses`의 X 값은?
- [ ] `[DB] Latest response date in Supabase query`의 날짜는?
- [ ] 최종적으로 `[Export] ✅ Final: Using X responses`의 X 값은?

이 정보들을 알려주시면 문제를 정확히 진단할 수 있습니다!

