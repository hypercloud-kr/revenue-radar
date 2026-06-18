// 첨부 본문 추출 (P1.5) — PDF·DOCX. 전부 로컬, 외부 서버 의존 없음.
// 안전 규칙(build-scope): 업로드 전용 · 추출 텍스트 30,000자 캡 · 실패 시 명확한 에러.
import mammoth from 'mammoth';
// pdf-parse의 index.js는 import 시 디버그 코드가 테스트 파일을 읽으려 함 → lib 직접 import로 회피.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

const MAX_CHARS = 30000;

// 제어문자 제거: 탭(9)·개행(10)·캐리지리턴(13)·일반 가시문자(>=32)만 보존.
function stripControl(s) {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c === 9 || c === 10 || c === 13 || c >= 32) out += ch;
  }
  return out;
}

export async function extractText(buffer, filename = '', mimetype = '') {
  const name = filename.toLowerCase();
  let text = '';

  if (name.endsWith('.pdf') || mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    text = data.text || '';
  } else if (
    name.endsWith('.docx') ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value || '';
  } else {
    const e = new Error('지원하지 않는 형식입니다. PDF 또는 DOCX만 업로드 가능합니다.');
    e.status = 415;
    throw e;
  }

  text = stripControl(text).replace(/[ \t]+\n/g, '\n').trim();

  const truncated = text.length > MAX_CHARS;
  if (truncated) text = text.slice(0, MAX_CHARS);

  return { chars: text.length, truncated, text };
}
