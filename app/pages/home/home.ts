import {Component, ViewChild} from '@angular/core';
import {NavController, Platform, ModalController, Content} from 'ionic-angular';
import {AudioService} from '../../common/AudioService';
import {NowPlaying} from '../now-playing/now-playing';
declare function require(path: string): any;
declare var cordova: any;
declare var Media: any;
declare var Dropbox: any;
@Component({
  templateUrl: 'build/pages/home/home.html'
})
export class HomePage {
  @ViewChild(Content) content: Content;
  constructor(private navCtrl: NavController,
    private platform: Platform,
    private as: AudioService,
    private modalCtrl: ModalController) {
      as.onSongChange = (() => {
        setTimeout(() => {
          let itemLoc = (<any>document.querySelector('.playing-in-list')).offsetTop;
          this.content.scrollTo(0, itemLoc - 100);
        }, 100)

      });
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
