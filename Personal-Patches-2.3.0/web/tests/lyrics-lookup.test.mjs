/* Copyright 2026 BDCrusher. GPL-3.0. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { lookupMessage } from '../src/lookup-status.js';
import { PlaybackClock } from '../src/playback-clock.js';
import { unisonContributors } from '../src/unison-source.js';
import { spicyContributors } from '../src/spicy-source.js';
import { processStreamData } from '../src/upstream-providers.ts';

test('no result changes from active lookup to the confirmed empty message', () => {
  assert.equal(lookupMessage('test', {pending: 2, waiting: 0}, 0, false, false), 'Looking for lyrics…');
  assert.equal(lookupMessage('test', {pending: 2, waiting: 2}, 0, false, false), 'Still checking for lyrics…');
  assert.equal(lookupMessage('test', {pending: 1, waiting: 0}, 0, true, false), 'Still checking for lyrics…');
  assert.equal(lookupMessage('test', {pending: 0}, 0, true, false), 'No lyrics found.');
});

test('authorization, metadata, decoding and transport failures retain distinct messages', () => {
  const status = (health, malformed = false) => lookupMessage('test', {pending: 0, ...health}, 0, false, malformed);
  assert.match(status({connectionNeeded: true}), /need a connection/);
  assert.match(status({metadataMissing: true}), /Track details unavailable/);
  assert.match(status({found: true}), /readable/);
  assert.match(status({}, true), /readable/);
  assert.match(status({failed: true}), /Couldn’t check all/);
  assert.match(lookupMessage('', {pending: 1}, 0, false, false), /Play a song/);
});

test('timed out lookup leaves the loading state even if the renderer is parsing', () => {
  assert.match(lookupMessage('test', {pending: 0, timedOut: true}, 1, true, false), /timed out/);
});

test('pause freezes the supplied position and a 500 ms running drift reanchors immediately', () => {
  const clock = new PlaybackClock();
  clock.accept({position: 10000, playing: true, rate: 1, sampledAt: 1000}, 0, 1000);
  clock.accept({position: 11000, playing: true, rate: 1, sampledAt: 1500}, 500, 1500);
  assert.equal(clock.read(500), 11000);
  clock.accept({position: 11250, playing: false, rate: 1, sampledAt: 1750}, 750, 1750);
  assert.equal(clock.read(3000), 11250);
  clock.accept({position: 11250, playing: true, rate: 1, sampledAt: 4000}, 3000, 4000);
  assert.equal(clock.read(3250), 11500);
});

test('Spicy broker results use Braccato for line and rich timing, with attribution', async () => {
  const attribution = {
    uploader: {username: 'Uploader', url: 'https://spicylyrics.org/u/uploader'},
    maker: {username: 'Sync Maker', url: 'https://spicylyrics.org/u/maker'},
  };
  for (const [variant, contents] of [
    ['spicy-synced', 'Test lyric'],
    ['spicy-richsynced', '<span begin="1s" end="2s">Test </span><span begin="2s" end="3s">lyric</span>'],
  ]) {
    const params = {duration: 10, sourceMap: {'spicy-synced': {}, 'spicy-richsynced': {}}};
    const lyrics = '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="1s" end="3s">' + contents + '</p></div></body></tt>';
    await processStreamData('provider', {provider: 'spicy', results: {lyrics, attribution}}, params);
    const result = params.sourceMap[variant].lyricSourceResult;
    assert.equal(result.lyrics[0].words, 'Test lyric');
    assert.equal(result.cacheAllowed, false);
    assert.equal(result.contributors.length, 3);
    assert.equal(result.contributors[2].url, attribution.maker.url);
  }
});

test('Spicy credits retain names and reject foreign, credentialed and insecure URLs', () => {
  for (const url of ['https://example.org/', 'https://name@spicylyrics.org/', 'http://spicylyrics.org/']) {
    const credits = spicyContributors({uploader: {username: 'Uploader', url}});
    assert.equal(credits[1].label, 'Uploaded by Uploader');
    assert.equal(credits[1].url, undefined);
  }
});

test('Unison credits link to the returned recording and contributor', () => {
  const data = {videoId: 'aBcDeFgHiJ1', submitter: {displayName: ' Lyric Maker ', keyId: 'curator_3'}};
  assert.deepEqual(unisonContributors(data), [
    {label: 'Lyrics from Unison', url: 'https://unison.betterlyrics.org/song/aBcDeFgHiJ1'},
    {label: 'Submitted by Lyric Maker', url: 'https://unison.betterlyrics.org/curator/curator_3'},
  ]);
  assert.equal(unisonContributors({...data, submitter: {displayName: 'Other', keyId: '../other'}}).length, 1);
  assert.deepEqual(unisonContributors({...data, videoId: '../song'}), []);
});
