import { EchoService } from '@/services/echoService.js';
import { defineStore } from 'pinia';

// Echo store — loads the 2026-10 echoes module once per session. Home and
// /analytics do not touch it (they keep the 19 local 24px thumbnails); only
// /echoes and /echoes/:id need the full 184-echo / 46-character dataset.
export const useEchoStore = defineStore('echo', {
  state: () => ({
    snapshot: null,
    loading: false,
    error: null,
  }),

  getters: {
    characters: (state) => state.snapshot?.characters ?? [],
    deckCharacters: (state) => state.snapshot?.deckCharacters ?? [],
    echoes: (state) => state.snapshot?.echoes ?? [],
    loaded: (state) => Boolean(state.snapshot),
  },

  actions: {
    async loadEchoes() {
      if (this.snapshot) return this.snapshot;
      this.loading = true;
      try {
        this.snapshot = await EchoService.load();
        this.error = null;
        return this.snapshot;
      } catch (error) {
        this.error = 'Failed to load echo data';
        console.error('Error loading echo data:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    characterById(id) {
      return this.snapshot?.charactersById.get(Number(id)) ?? null;
    },

    characterByStatsId(statsId) {
      return this.snapshot ? EchoService.characterByStatsId(statsId) : null;
    },

    echoesForCharacter(characterId) {
      return this.snapshot?.echoesByCharacter.get(Number(characterId)) ?? [];
    },

    scoresForCharacter(characterId) {
      return this.snapshot?.scoresByCharacter.get(Number(characterId)) ?? [];
    },
  },
});
