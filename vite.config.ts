/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// GitHub Pages 프로젝트 페이지(https://<user>.github.io/<repo>/)에 배포할 때는
// base가 "/<repo>/"여야 정적 자원이 올바르게 로드된다.
// GitHub Actions 환경에서는 GITHUB_REPOSITORY("owner/repo")에서 자동으로 유도하고,
// 필요하면 VITE_BASE 환경변수로 직접 지정할 수 있다. 로컬에서는 "/"를 사용한다.
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.VITE_BASE ?? (repoName ? `/${repoName}/` : '/');

export default defineConfig({
  base,
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
