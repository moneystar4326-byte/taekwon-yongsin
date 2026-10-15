import type { Poom } from './types';

export const LINES = {
  idle: '열한 개의 수련구슬이 모였습니다.',
  touch: '이 작은 손에, 우리의 노력이 담겨 있습니다.',
  chant: '열한 빛이여, 하늘을 열어라! 태권용신, 깨어나라!',
  dragon: '나를 깨운 용감한 수련생들이여. 너희의 도전을 기억하고 있다.',
  ready: '지금부터, 너희가 기다려온 소식을 전하겠다.',
  complete: '오늘의 성취를 가슴에 품고, 다음 도전으로 나아가라.',
} as const;

export const revealTitle = (poom: Poom) => `${poom}품 합격!`;

export const individualLine = (name: string, poom: Poom) => `${name}, ${poom}품 합격! 축하합니다.`;

export const groupLine = (poom: Poom) => `${poom}품 합격! 모두 축하합니다.`;
