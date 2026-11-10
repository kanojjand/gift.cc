import { randomInt } from 'node:crypto';
import { LIMITS } from './config.js';

const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_LENGTH = 12;
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

export const SONG_TYPES = Object.freeze({
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
});

export function generateCode() {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

export function generateCodes(count) {
  const codes = new Set();
  while (codes.size < count) codes.add(generateCode());
  return [...codes];
}

export function isValidCode(value) {
  return CODE_PATTERN.test(value);
}

export function isValidPhotoName(value) {
  return /^[a-f0-9]{16}\.jpg$/.test(value);
}

export function isValidSongFile(value) {
  return /^[a-f0-9]{24}\.(mp3|m4a|aac|ogg|wav)$/.test(value);
}

export function isJpeg(buffer) {
  return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function cleanLine(value) {
  return String(value ?? '').replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim();
}

function cleanMultiline(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\P{Cc}\n]/gu, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function lengthError(value, max, label) {
  if (!value) return `Заполните поле «${label}»`;
  if ([...value].length > max) return `«${label}»: не больше ${max} символов`;
  return null;
}

/**
 * @param {{ sender?: unknown, recipient?: unknown, message?: unknown }} input
 * @returns {{ ok: true, value: { sender: string, recipient: string, message: string } } | { ok: false, errors: Record<string, string> }}
 */
export function validateGreeting(input) {
  const value = {
    sender: cleanLine(input.sender),
    recipient: cleanLine(input.recipient),
    message: cleanMultiline(input.message),
  };
  const candidates = {
    sender: lengthError(value.sender, LIMITS.senderLength, 'От кого'),
    recipient: lengthError(value.recipient, LIMITS.recipientLength, 'Кому'),
    message: lengthError(value.message, LIMITS.messageLength, 'Текст поздравления'),
  };
  const errors = Object.fromEntries(Object.entries(candidates).filter(([, error]) => error));
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

export function parseQuantity(value) {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= LIMITS.batchSize ? quantity : null;
}

export function songExtension(filename) {
  const extension = String(filename).split('.').pop().toLowerCase();
  return Object.hasOwn(SONG_TYPES, extension) ? extension : null;
}
