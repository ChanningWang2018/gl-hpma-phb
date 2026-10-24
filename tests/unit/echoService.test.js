import { EchoService } from '@/services/echoService.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const IMAGE_BASE =
  'https://raw.githubusercontent.com/hpma-bits/hpma-spellbook/' +
  'echoes-v1.20261024.0/echoes/';
const ICON = 'images/icon_huixiang_hemin_001.png';
const ICON_WEBP = 'images_webp/icon_huixiang_hemin_001.webp';

describe('EchoService image resolution', () => {
  const originalSnapshot = EchoService.snapshot;

  beforeEach(() => {
    EchoService.snapshot = {
      versionInfo: {
        imageBase: IMAGE_BASE,
        imagesWebp: 'images_webp/',
      },
    };
  });

  afterEach(() => {
    EchoService.snapshot = originalSnapshot;
  });

  it('derives the L1 WebP and PNG URLs from version.json imageBase', () => {
    expect(EchoService.imageUrl(ICON, 'webp')).toBe(
      `${IMAGE_BASE}${ICON_WEBP}`,
    );
    expect(EchoService.imageUrl(ICON)).toBe(`${IMAGE_BASE}${ICON}`);
  });

  it('derives the L2 same-origin proxy URL without hardcoding a host', () => {
    expect(EchoService.proxyImageUrl(ICON)).toBe(`/echoimg/${ICON}`);
    expect(EchoService.proxyImageUrl(ICON, 'webp')).toBe(
      `/echoimg/${ICON_WEBP}`,
    );
  });

  it('chains L1 WebP -> L1 PNG -> /echoimg -> local deck avatar', () => {
    expect(EchoService.imageCandidates(ICON, { statsId: 1 })).toEqual([
      `${IMAGE_BASE}${ICON_WEBP}`,
      `${IMAGE_BASE}${ICON}`,
      `/echoimg/${ICON}`,
      '/images/avatars/echo01.webp',
    ]);
  });

  it('dedupes the proxy when imageBase already points at /echoimg/', () => {
    EchoService.snapshot.versionInfo.imageBase = '/echoimg/';
    expect(EchoService.imageCandidates(ICON, { statsId: 2 })).toEqual([
      `/echoimg/${ICON_WEBP}`,
      `/echoimg/${ICON}`,
      '/images/avatars/echo02.webp',
    ]);
  });

  it('includes the fallback path before the proxy level', () => {
    const big = 'images/icon_huixiang_hemin_big.png';
    expect(
      EchoService.imageCandidates(ICON, { fallbackPath: big, statsId: 1 }),
    ).toEqual([
      `${IMAGE_BASE}${ICON_WEBP}`,
      `${IMAGE_BASE}${ICON}`,
      `${IMAGE_BASE}images_webp/icon_huixiang_hemin_big.webp`,
      `${IMAGE_BASE}${big}`,
      `/echoimg/${ICON}`,
      `/echoimg/${big}`,
      '/images/avatars/echo01.webp',
    ]);
  });

  it('keeps the proxy level when version.json has no imageBase', () => {
    EchoService.snapshot = { versionInfo: { imageBase: '', imagesWebp: null } };
    expect(EchoService.imageUrl(ICON)).toBeNull();
    expect(EchoService.imageUrl(ICON, 'webp')).toBeNull();
    expect(EchoService.imageCandidates(ICON, { statsId: 7 })).toEqual([
      `/echoimg/${ICON}`,
      '/images/avatars/echo07.webp',
    ]);
    expect(EchoService.imageCandidates('', { statsId: 7 })).toEqual([
      '/images/avatars/echo07.webp',
    ]);
  });

  it('only offers local avatars for the tracked 1..19 stats ids', () => {
    expect(EchoService.localAvatarUrl(1)).toBe('/images/avatars/echo01.webp');
    expect(EchoService.localAvatarUrl('19')).toBe(
      '/images/avatars/echo19.webp',
    );
    expect(EchoService.localAvatarUrl(0)).toBeNull();
    expect(EchoService.localAvatarUrl(20)).toBeNull();
    expect(EchoService.localAvatarUrl(null)).toBeNull();
    expect(EchoService.localAvatarUrl('abc')).toBeNull();
  });

  it('picks icon before big_icon for the component fallback path', () => {
    expect(
      EchoService.characterIconPath({ icon: ICON, big_icon: 'x.png' }),
    ).toBe(ICON);
    expect(
      EchoService.characterIconPath({ icon: null, big_icon: 'big.png' }),
    ).toBe('big.png');
    expect(EchoService.characterIconPath(null)).toBeNull();
  });
});
