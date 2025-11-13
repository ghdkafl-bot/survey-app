# 퇴원환자 친절도 설문 시스템

퇴원환자용 친절도 설문 조사를 위한 웹 애플리케이션입니다.

## 주요 기능

1. **관리자 페이지**: 설문 생성 및 결과 확인
2. **설문 생성**: 여러 문항을 추가할 수 있는 설문 생성 기능
3. **설문 응답**: 1-5점 척도 및 해당없음 옵션 (상호 배타적 라디오 버튼)
4. **Excel 다운로드**: 설문 결과를 Excel 파일로 다운로드
5. **환자 정보 커스터마이징**: 환자 유형/성함 라벨, 선택지, 필수 여부 등을 관리자에서 직접 설정

## 기술 스택

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Supabase** (PostgreSQL + Authentication)

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

### 3. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 Supabase 프로젝트 정보를 입력하세요.

```
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

> `service_role` 키는 서버 전용이므로 GitHub이나 프론트엔드 코드에 노출되지 않도록 주의하세요.

## 사용 방법

### 관리자 페이지

1. 홈페이지에서 "관리자 페이지" 클릭
2. "새 설문 만들기" 버튼 클릭
3. 설문 제목, 설명, 문항들을 입력
4. "문항 추가" 버튼으로 여러 문항 추가 가능
5. "설문 생성" 버튼으로 설문 생성

### 설문 응답

1. 홈페이지에서 "설문 참여" 클릭
2. 원하는 설문 선택
3. 각 문항에 대해 1-5점 또는 해당없음 선택
4. "설문 제출" 버튼 클릭

### 결과 다운로드

1. 관리자 페이지에서 원하는 설문의 "Excel 다운로드" 버튼 클릭
2. Excel 파일이 자동으로 다운로드됩니다

## Supabase 설정 가이드

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만들고 **Project Settings → API**에서 `Project URL`, `anon public key`, `service_role key`를 확인합니다.
2. Supabase Table editor 또는 SQL 에디터에서 아래 테이블을 생성하세요. (모든 FK는 `ON DELETE CASCADE` 설정 권장)

```sql
create table surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  background_color text,
  patient_info_config jsonb,
  closing_message jsonb,
  created_at timestamptz not null default now()
);

create table question_groups (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid references surveys(id) on delete cascade,
  title text not null,
  "order" integer default 0
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references question_groups(id) on delete cascade,
  text text not null,
  "order" integer default 0,
  type text not null,
  include_none_option boolean,
  required boolean default false
);

create table sub_questions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions(id) on delete cascade,
  text text not null,
  "order" integer default 0
);

create table responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid references surveys(id) on delete cascade,
  patient_name text,
  patient_type text,
  patient_info_answers jsonb,
  question_snapshot jsonb,
  submitted_at timestamptz not null default now()
);

create table answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid references responses(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  sub_question_id uuid references sub_questions(id),
  value integer,
  text_value text
);

create table homepage_config (
  id text primary key default 'default',
  title text not null,
  description text not null,
  updated_at timestamptz not null default now()
);
```

이미 테이블을 만든 상태라면 다음 명령으로 필요한 컬럼과 테이블을 추가하세요.

```sql
alter table surveys add column if not exists patient_info_config jsonb;
alter table responses add column if not exists patient_info_answers jsonb;
alter table responses add column if not exists question_snapshot jsonb;
alter table questions add column if not exists required boolean default false;

create table if not exists homepage_config (
  id text primary key default 'default',
  title text not null,
  description text not null,
  updated_at timestamptz not null default now()
);

-- 기본값 삽입 (테이블이 비어있을 경우)
insert into homepage_config (id, title, description)
values ('default', '퇴원환자 친절도 설문', '환자 만족도 조사를 위한 설문 시스템입니다. 참여를 통해 더 나은 서비스를 만들어주세요.')
on conflict (id) do nothing;
```

3. 필요하다면 Row Level Security(RLS)를 비활성화하거나 정책을 추가합니다. (기본 상태는 비활성화)
4. `.env.local`에 위에서 확인한 URL과 서비스 키를 입력합니다.
5. `npm run dev`로 동작을 확인하고, 설문/응답이 Supabase 테이블에 저장되는지 검증하세요.

## 데이터 보존 및 백업

### Supabase 데이터 보존 정책

**중요**: Supabase는 **용량 초과 시 자동으로 데이터를 삭제하지 않습니다**. 하지만 다음 사항을 주의하세요:

1. **무료 플랜 제한**:
   - 데이터베이스 저장 공간: **500MB**
   - 용량 초과 시: 프로젝트가 읽기 전용 모드로 전환되거나 새 데이터 추가가 제한될 수 있습니다
   - 자동 삭제: **없음** (Supabase가 자동으로 데이터를 삭제하지 않습니다)

2. **데이터 손실 가능성**:
   - ✅ **용량 초과로 인한 자동 삭제**: 없음
   - ⚠️ **관리자 페이지에서 실수로 삭제**: 가능 (응답 삭제, 설문 삭제 버튼)
   - ⚠️ **CASCADE DELETE**: 설문 삭제 시 모든 응답이 자동으로 삭제됩니다
   - ⚠️ **데이터베이스 오류**: 드물지만 가능

3. **데이터 확인 방법**:
   - 관리자 페이지에서 **"데이터 상태 확인"** 버튼 클릭
   - Supabase 대시보드에서 직접 확인
   - Excel 다운로드로 백업

### 데이터 백업 방법

1. **Excel 다운로드** (권장):
   - 관리자 페이지에서 각 설문별로 Excel 다운로드
   - 날짜 범위 없이 전체 데이터 다운로드
   - 정기적으로 백업 (예: 주 1회)

2. **Supabase 대시보드 백업**:
   - Supabase 대시보드 → Database → Backup
   - 자동 백업 설정 (유료 플랜)
   - 수동 백업 (SQL 덤프)

3. **데이터 상태 확인**:
   - 관리자 페이지에서 **"데이터 상태 확인"** 버튼 클릭
   - 총 설문 수, 응답 수, 저장 공간 사용량 확인
   - 400MB 이상 사용 시 경고 메시지 표시

### 데이터 손실 방지

1. **정기적인 백업**: Excel 다운로드로 정기적으로 백업
2. **삭제 전 확인**: 응답 삭제 또는 설문 삭제 전 반드시 확인
3. **데이터 상태 확인**: 관리자 페이지에서 주기적으로 데이터 상태 확인
4. **Supabase 모니터링**: Supabase 대시보드에서 저장 공간 사용량 모니터링

## Vercel 배포

1. GitHub에 프로젝트 푸시
2. Vercel에 프로젝트 연결
3. Vercel **Environment Variables**에 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 추가
4. 배포 완료

## 프로젝트 구조

```
survey-app/
├── app/
│   ├── admin/          # 관리자 페이지
│   ├── surveys/        # 설문 목록 페이지
│   ├── survey/[id]/    # 설문 응답 페이지
│   ├── api/            # API 라우트
│   └── page.tsx        # 홈페이지
├── lib/
│   ├── db.ts           # Supabase 기반 데이터베이스 로직
│   └── supabaseClient.ts
└── package.json
```

