import {Component, NgZone} from '@angular/core';
import {NavController, Platform, ModalController, Content, ActionSheetController, LoadingController} from 'ionic-angular';
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
  private keyboardHeight: number = 0;
  private easeInOutQuad: any = (t) =>  t<.5 ? 2*t*t : -1+(4-2*t)*t;
  constructor(private navCtrl: NavController,
    private platform: Platform,
    private as: AudioService,
    private modalCtrl: ModalController,
    private zone: NgZone,
    private actionSheetCtrl: ActionSheetController,
    private loadingCtrl: LoadingController
  ) {
      // as.onSongChange = (() => {
      //   setTimeout(() => {
      //     var target = document.querySelector(".playing-in-list");
      //     this.scrollTo((<any>target).offsetTop - 100,
      //       350, this.easeInOutQuad,() => {});
      //   }, 200)
      //
      // });
      platform.ready().then(() => {
        if ((<any>window).plugins) {
          // window.addEventListener('statusTap', () => {
          //   this.scrollTo(0, 350,this.easeInOutQuad, () => {});
          // });
          // const keyboardShowHandler = (e) => {
          //   this.zone.run(() => {
          //     this.keyboardHeight = e.keyboardHeight;
          //   });
          // }
          // window.addEventListener('native.keyboardshow', keyboardShowHandler);
          // const keyboardHideHandler = (e) => {
          //   this.zone.run(() => {
          //     this.keyboardHeight = 0;
          //   });
          // }
          // window.addEventListener('native.keyboardhide', keyboardHideHandler);
        }
      })
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
  scrollTo(Y, duration, easingFunction, callback) {

    var start = Date.now(),
  	elem = document.querySelector('scroll-content');
  	let from = elem.scrollTop;

    if(from === Y) {
        callback();
        return; /* Prevent scrolling to the Y point if already there */
    }

    let min = (a,b) => {
    	return a<b?a:b;
    }

    let scroll = (timestamp) => {

        var currentTime = Date.now(),
            time = min(1, ((currentTime - start) / duration)),
            easedT = easingFunction(time);

        elem.scrollTop = (easedT * (Y - from)) + from;

        if(time < 1) requestAnimationFrame(scroll);
        else
            if(callback) callback();
    }

    requestAnimationFrame(scroll)
  }
  options() {
    let actionSheet = this.actionSheetCtrl.create({
      title: 'Dropbox Options',
      buttons: [
        {
          text: 'Logout',
          role: 'destructive',
          handler: () => {
            this.as.logout();
          }
        },{
          text: 'Refresh Songs',
          handler: () => {
            let loading = this.loadingCtrl.create({
              content: 'Loading...'
            });
            loading.present();

            this.as.getAllSongs().then(() => {
              loading.dismiss();
            });
          }
        },{
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
            console.log('Cancel clicked');
          }
        }
      ],
    });
    actionSheet.present();
  }
  playNext(song) {
    let actionSheet = this.actionSheetCtrl.create({
      title: song.title,
      buttons: [
        {
          text: 'Play this next',
          handler: () => {
            console.log(song);
            this.as.playNextInQueue(song);
          }
        },{
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
            console.log('Cancel clicked');
          }
        }
      ],
      enableBackdropDismiss: false,
    });
    actionSheet.present();
  }
}
