/**
 * Window bridge.
 *
 * The HTML shell still uses inline `onclick="..."` attributes for the menu
 * buttons and the map/climate picker. Inline handlers resolve against the
 * global object, but the game now lives in ES modules, so the handful of
 * functions they call have to be published on `window`.
 *
 * This module is imported last by main.ts so every binding exists before the
 * first click.
 */
import { AudioSystem } from '../audio/sfx.ts';
import { toggleMenuMusic, playNextTrack, updateMusicVolume, updateSFXVolume } from '../audio/music.ts';
import { openPowersModal, toggleChronicles, resolveCrisis, unlockPower } from '../systems/faith.ts';
import { applyPower } from '../systems/power.ts';
import { setSpeed, toggleSetting, updateBrushSize, toggleCurseMenu, selectCurse } from './input.ts';
import {
  selectMap, selectClimate, launchGame, openInGameMenu, closeInGameMenu,
  restartGame, exitToMainMenu, resumeGame,
} from './modals.ts';
import { openModal, closeModal } from './modal-utils.ts';
import {
  openInstructions, closeInstructions, openSettings, closeSettings,
  openAboutFromPause, closeAbout, consentMusic, toggleFullScreen, volverECGAME,
} from './misc.ts';
import { manualSave } from '../core/storage.ts';

declare global {
  interface Window {
    AudioSystem: typeof AudioSystem;
    toggleMenuMusic: typeof toggleMenuMusic;
    playNextTrack: typeof playNextTrack;
    updateMusicVolume: typeof updateMusicVolume;
    updateSFXVolume: typeof updateSFXVolume;
    openPowersModal: typeof openPowersModal;
    applyPower: typeof applyPower;
    toggleChronicles: typeof toggleChronicles;
    resolveCrisis: typeof resolveCrisis;
    unlockPower: typeof unlockPower;
    setSpeed: typeof setSpeed;
    toggleSetting: typeof toggleSetting;
    updateBrushSize: typeof updateBrushSize;
    toggleCurseMenu: typeof toggleCurseMenu;
    selectCurse: typeof selectCurse;
    selectMap: typeof selectMap;
    selectClimate: typeof selectClimate;
    launchGame: typeof launchGame;
    openInGameMenu: typeof openInGameMenu;
    closeInGameMenu: typeof closeInGameMenu;
    restartGame: typeof restartGame;
    exitToMainMenu: typeof exitToMainMenu;
    resumeGame: typeof resumeGame;
    manualSave: typeof manualSave;
    openModal: typeof openModal;
    closeModal: typeof closeModal;
    openInstructions: typeof openInstructions;
    closeInstructions: typeof closeInstructions;
    openSettings: typeof openSettings;
    closeSettings: typeof closeSettings;
    openAboutFromPause: typeof openAboutFromPause;
    closeAbout: typeof closeAbout;
    consentMusic: typeof consentMusic;
    toggleFullScreen: typeof toggleFullScreen;
    volverECGAME: typeof volverECGAME;
  }
}

const bridge: Partial<Window> = {
  AudioSystem,
  toggleMenuMusic, playNextTrack, updateMusicVolume, updateSFXVolume,
  openPowersModal, toggleChronicles, resolveCrisis, unlockPower, applyPower,
  setSpeed, toggleSetting, updateBrushSize, toggleCurseMenu, selectCurse,
  selectMap, selectClimate, launchGame, openInGameMenu, closeInGameMenu,
  restartGame, exitToMainMenu, resumeGame, manualSave,
  openModal, closeModal,
  openInstructions, closeInstructions, openSettings, closeSettings,
  openAboutFromPause, closeAbout, consentMusic, toggleFullScreen, volverECGAME,
};

for (const [key, fn] of Object.entries(bridge)) {
  (window as any)[key] = fn;
}
