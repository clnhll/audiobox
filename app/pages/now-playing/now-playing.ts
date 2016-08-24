import {Component} from '@angular/core';
import {NavController, ViewController} from 'ionic-angular';
import {AudioService} from '../../common/AudioService';
@Component({
  templateUrl: 'build/pages/now-playing/now-playing.html'
})
export class NowPlaying {
  private buttonPressed: boolean = false;

  constructor(
    private navCtrl: NavController,
    private as: AudioService,
    private viewCtrl: ViewController) {
  }

  dismiss() {
    this.viewCtrl.dismiss();
  }

  playPause() {
    this.buttonPressed = true;
    this.as.playPause();
    setTimeout(() => {
      this.buttonPressed = false;
    }, 1000)
  }

}
