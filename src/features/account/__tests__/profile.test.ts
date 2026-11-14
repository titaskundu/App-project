import { describe, expect, it } from '@jest/globals';

import {
  ageOn,
  birthDateError,
  emailError,
  initials,
  isOldEnough,
  nameError,
  normalizeUsername,
  passwordError,
  suggestUsername,
  toIsoDate,
  usernameError,
} from '../profile';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

describe('username', () => {
  it('normalizes case, spaces and a leading @', () => {
    expect(normalizeUsername('  @Titas_K ')).toBe('titas_k');
  });
  it('checks length and characters', () => {
    expect(usernameError('ab')).toMatch(/At least 3/);
    expect(usernameError('a'.repeat(21))).toMatch(/At most 20/);
    expect(usernameError('titas.k')).toMatch(/Only letters/);
    expect(usernameError('Titas_K99')).toBeNull();
  });
  it('suggests a valid username from a name', () => {
    expect(suggestUsername('Titas Kundu')).toBe('titas_kundu');
    expect(suggestUsername('Zoë  O’Brien!')).toBe('zoe_obrien');
    expect(suggestUsername('Al')).toBe('alpanda');
    expect(usernameError(suggestUsername('A very very long name indeed'))).toBeNull();
  });
});

describe('name, email, password', () => {
  it('name', () => {
    expect(nameError('  ')).toBeTruthy();
    expect(nameError('x'.repeat(41))).toBeTruthy();
    expect(nameError('Titas')).toBeNull();
  });
  it('email', () => {
    expect(emailError('')).toBeTruthy();
    expect(emailError('titas@')).toBeTruthy();
    expect(emailError('a b@c.de')).toBeTruthy();
    expect(emailError(' someone@example.de ')).toBeNull();
  });
  it('password', () => {
    expect(passwordError('short1')).toMatch(/At least 8/);
    expect(passwordError('onlyletters')).toMatch(/number/);
    expect(passwordError('12345678')).toMatch(/number/);
    expect(passwordError('panda2026')).toBeNull();
    expect(passwordError('a1'.repeat(40))).toMatch(/At most/);
  });
});

describe('dates and age', () => {
  it('only real calendar dates', () => {
    expect(toIsoDate(2008, 2, 29)).toBe('2008-02-29');
    expect(toIsoDate(2009, 2, 29)).toBeNull();
    expect(toIsoDate(2008, 13, 1)).toBeNull();
    expect(toIsoDate(1899, 1, 1)).toBeNull();
    expect(toIsoDate(2008, 4, 31)).toBeNull();
  });

  it('turns 16 exactly on the birthday', () => {
    expect(ageOn('2010-11-14', day(2026, 11, 13))).toBe(15);
    expect(ageOn('2010-11-14', day(2026, 11, 14))).toBe(16);
    expect(isOldEnough('2010-11-14', day(2026, 11, 13))).toBe(false);
    expect(isOldEnough('2010-11-14', day(2026, 11, 14))).toBe(true);
  });

  it('29 Feb birthdays count from 1 Mar in non-leap years', () => {
    expect(ageOn('2008-02-29', day(2024, 2, 28))).toBe(15);
    expect(ageOn('2008-02-29', day(2024, 2, 29))).toBe(16);
    // Non-leap year: still 16 on 28 Feb, 17 from 1 Mar.
    expect(ageOn('2012-02-29', day(2029, 2, 28))).toBe(16);
    expect(ageOn('2012-02-29', day(2029, 3, 1))).toBe(17);
  });

  it('flags impossible birth dates', () => {
    expect(birthDateError(null, day(2026, 11, 14))).toBeTruthy();
    expect(birthDateError('2030-01-01', day(2026, 11, 14))).toMatch(/hasn't happened/);
    expect(birthDateError('1900-01-01', day(2026, 11, 14))).toMatch(/year/);
    expect(birthDateError('2000-05-05', day(2026, 11, 14))).toBeNull();
  });
});

describe('initials', () => {
  it('first and last name', () => {
    expect(initials('Titas Kundu')).toBe('TK');
    expect(initials('panda')).toBe('P');
    expect(initials('  ')).toBe('?');
    expect(initials('Anna Maria Schmidt')).toBe('AS');
  });
});
