import {Component} from '@angular/core';
import {NavController, Platform, ModalController} from 'ionic-angular';
import {AudioService} from '../../common/AudioService';
import {NowPlaying} from '../about/about';
declare function require(path: string): any;
declare var cordova: any;
declare var Media: any;
declare var Dropbox: any;
@Component({
  templateUrl: 'build/pages/home/home.html'
})
export class HomePage {
  constructor(private navCtrl: NavController,
    private platform: Platform,
    private as: AudioService,
    private modalCtrl: ModalController) {

  }
  goToNowPlaying() {
    let nowPlayingModal = this.modalCtrl.create(NowPlaying);
    nowPlayingModal.present();
    (<HTMLElement>document.activeElement).blur()
  }
  playSong(song, goToNowPlaying = false) {
    this.as.playSong(song);
    if (goToNowPlaying) {
      this.goToNowPlaying();
    }
  }
}
