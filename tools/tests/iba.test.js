import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../../data/cocktails.json', import.meta.url), 'utf8'));
// Official list, https://iba-world.com/cocktails/all-cocktails/, checked 2026-11-08.
// Site slugs preserve the existing URLs for alternate names.
const official = `
brandy-alexander americano angel-face aviation boulevardier brandy-crusta
casino clover-club daiquiri martini gin-fizz hanky-panky john-collins
last-word manhattan martinez mary-pickford monkey-gland negroni
old-fashioned paradise planters-punch porto-flip ramos-gin-fizz
remember-the-maine rusty-nail sazerac sidecar stinger tuxedo vieux-carre
whiskey-sour white-lady
bellini black-russian bloody-mary caipirinha cardinale champagne-cocktail
corpse-reviver-2 cosmopolitan cuba-libre french-75 french-connection garibaldi
grasshopper hemingway-daiquiri horses-neck irish-coffee kir lemon-drop-martini
long-island-iced-tea mai-tai margarita mimosa mint-julep mojito moscow-mule
pina-colada pisco-sour rabo-de-galo sea-breeze sex-on-the-beach singapore-sling
tequila-sunrise vesper zombie
bees-knees bramble canchanchara chartreuse-swizzle dark-n-stormy
dons-special-daiquiri espresso-martini fernandito french-martini
gin-basil-smash grand-margarita iba-tiki illegal jungle-bird missionarys-downfall
naked-and-famous new-york-sour old-cuban paloma paper-plane penicillin
pisco-punch porn-star-martini russian-spring-punch sherry-cobbler southside
spicy-fifty aperol-spritz suffering-bastard three-dots-and-a-dash tipperary
tommys-margarita trinidad-sour ve-n-to
between-the-sheets
`.trim().split(/\s+/);

test('IBA tag covers the complete current official list without duplicate variants', () => {
  assert.equal(new Set(official).size, 102);
  assert.deepEqual(data.cocktails.filter(c => c.tags.includes('IBA')).map(c => c.slug).sort(), official.sort());
});

test('new citrus ingredients participate in derived citrus filters', () => {
  const get = slug => data.cocktails.find(c => c.slug === slug);
  assert.deepEqual(get('sherry-cobbler').citrus, ['orange', 'lemon']);
  assert.deepEqual(get('grand-margarita').citrus, ['orange', 'lime']);
  assert.deepEqual(get('long-island-iced-tea').base, ['vodka', 'agave', 'rum', 'gin']);
});
