import {Injectable, NgZone} from '@angular/core';
import {Platform, LoadingController} from 'ionic-angular';
declare var Dropbox: any;
declare var cordova: any;
declare var jsmediatags: any;
declare var plugins: any;
declare var NowPlaying: any;
declare var RemoteCommand: any;
declare var DirectoryReader: any;
declare var ID3: any;

@Injectable()
export class AudioService {

  public useLocal: boolean = false;
  public nowPlaying: any;
  public bufferedSong: any;
  public currentTime: number;
  public duration: number;
  public playing: boolean = false;
  private db: any;
  public shuffle: boolean = localStorage.getItem('shuffle') ?
    JSON.parse(localStorage.getItem('shuffle')) : false;
  public songs = localStorage.getItem('db-songs') ? JSON.parse(localStorage.getItem('db-songs')) : [];
  private bufferedMetadataPromise: any;
  public songsBackup = [...this.songs];
  private queue = this.shuffle ? this.shuffleSongs() : this.songs;
  private queueBackup = [...this.queue];
  public repeatOne: boolean = localStorage.getItem('repeatOne') ?
    JSON.parse(localStorage.getItem('repeatOne')) :
    false;
  public repeatAll: boolean = localStorage.getItem('repeatAll') ?
    JSON.parse(localStorage.getItem('repeatAll')) :
    false;
  public nowPlayingIndex: number = -1;
  public nowPlayingSongMeta: any;
  public nowPlayingSong: any;
  public nowPlayingSongUrl: string;
  public nowPlayingBufferedPercent: number;
  public bufferedSongInfo: any;
  public checkInterval: any;
  public filterQuery: string = '';
  private bufferedSongUrl: string;
  public onSongChange: any = () => {};

  constructor(private platform: Platform, private zone: NgZone, private loadingCtrl: LoadingController) {
    let loading: any = false;
    if (!this.songs.length) {
      loading = this.loadingCtrl.create({
        content: 'Loading...'
      });
      loading.present();
    }
    platform.ready().then(() => {
      this.authenticate()
        .then(this.getAllSongs.bind(this))
        .then(() => {
          if (loading) loading.dismiss();
        });
      if (!(<any>window).NowPlaying) {
        Object.assign(window, {NowPlaying: {set: (obj) => console.log(obj)}});
      }
      if (!(<any>window).plugins) return;
      RemoteCommand.on('command', (command) => {
        this.zone.run(() => {
          ({
            'nextTrack': this.playNextSong.bind(this),
            'previousTrack': this.back.bind(this),
            'play': this.playPause.bind(this),
            'pause': this.playPause.bind(this)
          })[command]()
        })
      });
    });
  }

  authenticate() {
    if (this.useLocal) return Promise.resolve(true);
    return new Promise((resolve, reject) => {
      this.platform.ready().then(() => {
        var client = new Dropbox.Client({key: "0hamg1r92zjn9sc"});
          client.authDriver((<any>window).cordova ?
          new Dropbox.AuthDriver.Cordova() :
          new Dropbox.AuthDriver.Redirect());
          client.authenticate((error, db) => {
            if (error) {
              reject(error);
              return;
            }
            this.db = db;
            (<any>window).db = db;
            resolve();
          });
      });
    });
  }

  getAllSongs(): any {
    if (this.useLocal && (<any>window).plugins) {
      return new Promise((resolve, reject) => {
        let dir = new DirectoryReader(cordova.file.documentsDirectory);
        dir.readEntries(res => {
          resolve(res);
        }, reject);
      }).then((res) => {
        this.songs = res;
        this.songsBackup = [...<any>res];
        this.queue = res;
        this.queueBackup = [...<any>res];
        (<any>window).songs = res;
      });
    }
    return Promise.all(['mp3', 'wav', 'm4a'].map(type =>
      new Promise((resolve, reject) => {
        this.db.search('', type, (err, res) => {
          if (err) reject();
          resolve(res);
        })
      })
    )).then(this.formatSongs.bind(this));
  }

  formatSongs(res) {
    res.forEach(format => {
      let paths = this.songs.map(song => song.path);
      this.songs = this.songs.concat(format
          .filter(song => song.isFile && !paths.includes(song.path))
          .map((song) => Object.assign(song, {
            title: song.path.split('/').reverse()[0].replace('.mp3', '').replace('.wav', '').replace('.m4a', ''),
            path: song.path,
            isFile: song.isFile
          }))
          .sort((a, b) => a.path < b.path ? -1 : 1)
        );
        (<any>window).songs = this.songs;
    });
    this.queue = this.shuffle ? this.shuffleSongs() : this.songs;
    this.songsBackup = [...this.songs];
    this.queueBackup = [...this.queue];
    localStorage.setItem('db-songs', JSON.stringify(this.songs));
  }

  getSongUrl(song) {
    let path = song.path;
    if (this.useLocal) {
      return Promise.resolve(song.toURL());
    }
    return new Promise((resolve, reject) => {
      this.db.makeUrl(path, {download: true}, (err, res) => {
        if (err) reject(err);
        resolve(res.url);
      });
    });
  }

  playSong(song) {

    this.getSongUrl(song).then(this.playUrl.bind(this));
    this.nowPlayingSong = song;
    this.nowPlayingIndex = this.queue.indexOf(song);
    this.bufferNext();
  }

  playUrl(url) {
    if (this.nowPlaying) {
      this.nowPlaying.pause();
      delete this.nowPlaying;
    }
    this.nowPlaying = new Audio;
    this.nowPlaying.onended = () => {
      this.zone.run(() => {
        if (this.repeatOne) {
          this.nowPlaying.currentTime = 0;
          this.nowPlaying.play();
          this.onSongChange();
        } else {
          this.playNextSong();
        }
      });
    }
    if (this.nowPlaying) {
      this.nowPlaying.pause();
    }
    let metaPromise = this.getMeta(url);
    this.nowPlaying.onplaying = () => {
      metaPromise.then(this.setLockScreenInfo.bind(this));
      this.nowPlaying.onplaying = null;
    }
    this.nowPlaying.src = url;
    this.nowPlaying.load();
    this.nowPlaying.play();
    this.setUpTimeTracking()
    this.nowPlayingSongUrl = url;
    this.onSongChange();
  }

  playNextSong() {
    if (this.bufferedSong) {
      this.nowPlayingIndex++;
      this.playBufferedSong();
      return;
    }
    if (this.canPlayNextSong()) {
      const nextSong = this.getNextSongToPlay();
      if (this.nowPlayingIndex === this.queue.length - 1) {
        this.nowPlayingIndex = 0;
      } else {
        this.nowPlayingIndex++;
      }
      this.playSong(nextSong);
    }
  }

  canGoBack() {
    return this.nowPlayingIndex > 0;
  }

  canPlayNextSong() {
    return this.nowPlayingIndex !== this.queue.length - 1 || this.repeatAll;
  }

  getNextSongToPlay() {
    return this.nowPlayingIndex === this.queue.length - 1 ? this.queue[0] : this.queue[this.nowPlayingIndex + 1];
  }

  toggleShuffle() {
    this.shuffle = !this.shuffle;
    localStorage.setItem('shuffle', JSON.stringify(this.shuffle));
    this.queue = this.shuffle ? this.shuffleSongs() : this.songs;
    delete this.bufferedSong;
    delete this.bufferedSongInfo;
    delete this.bufferedSongUrl;
    delete this.bufferedMetadataPromise;
    this.nowPlayingIndex = this.queue.indexOf(this.nowPlayingSong);
    this.bufferNext();
  }

  pause() {
    this.nowPlaying.pause();
  }

  play() {
    if (this.nowPlaying) {
      this.nowPlaying.play();
      this.playing = true;
      this.setLockScreenInfo();
    } else {
      this.playNextSong();
    }
  }

  back() {
    if (this.nowPlaying.currentTime > 5) {
      this.nowPlaying.currentTime = 0;
      this.setLockScreenInfo();
    } else {
      if (this.canGoBack()) {
        this.nowPlayingIndex -= 1;
        this.playSong(this.queue[this.nowPlayingIndex]);
      } else {
        this.nowPlaying.pause();
        this.nowPlaying.currentTime = 0;
        this.setLockScreenInfo();
      }
    }
  }

  bufferNext() {
    if (this.canPlayNextSong()) {
      this.bufferedSongInfo = this.getNextSongToPlay();
      this.getSongUrl(this.bufferedSongInfo).then(url => {
        this.bufferedSongUrl = <string>url;
        let x = new Audio;
        x.src = <string>url;
        x.load();
        this.bufferedSong = x;
        this.bufferedMetadataPromise = this.getMeta(url, true);
      });
    } else {
      delete this.bufferedSong;
      delete this.bufferedSongInfo;
    }
  }

  playBufferedSong() {
    this.zone.run(() => {
      this.nowPlaying.pause();
      this.nowPlayingSongUrl = this.bufferedSongUrl;
      delete this.nowPlaying;
      this.nowPlaying = this.bufferedSong;
      this.nowPlayingSong = this.bufferedSongInfo;
      this.nowPlaying.onended = this.playNextSong.bind(this);

      delete this.bufferedSong;
      delete this.bufferedSongInfo;
      this.nowPlaying.onplaying = () => {
        this.bufferedMetadataPromise.then((meta) => {
          this.nowPlayingSongMeta = meta;
          this.setLockScreenInfo();
          this.nowPlaying.onplaying = null;
        });
      }
      this.nowPlaying.play();
      this.bufferNext();
      this.onSongChange();
      this.setUpTimeTracking()
    })

  }

  playPause() {
    if (this.playing) {
      this.nowPlaying.pause();
      this.setLockScreenInfo();
      this.playing = false;
    } else {
      this.play();
    }
  }

  shuffleSongs () {
    let array = [...this.songs];
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
    return array;
  }

  filterQueue(event) {
    if (!event.target.value || event.target.value === '') {
      this.clearFilter();
    } else {
      let filteredSongs = this.songsBackup.filter(song =>
        song.path.toLowerCase().includes(event.target.value.toLowerCase()));
      this.nowPlayingIndex = filteredSongs.indexOf(this.nowPlayingSong);
      this.queue = this.queueBackup.filter(song =>
        song.path.toLowerCase().includes(event.target.value.toLowerCase()));
      this.songs = filteredSongs;
    }
  }

  clearFilter() {
    this.songs = this.songsBackup;
    this.queue = this.queueBackup;
    this.nowPlayingIndex = this.queue.indexOf(this.nowPlayingSong);
  }

  setUpTimeTracking() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.checkInterval = setInterval(() => {
      if (this.nowPlaying && !this.nowPlaying.paused) {
        this.playing = !this.nowPlaying.paused;
        this.currentTime = this.nowPlaying.currentTime;
        this.duration = this.nowPlaying.duration;
        this.nowPlayingBufferedPercent = this.nowPlaying.buffered.length ? 100 * (this.nowPlaying.buffered.end(0) / this.duration) : 0;
      }
    });
  }

  updateTime(x) {
    this.nowPlaying.currentTime = x;
    NowPlaying.set({
      elapsedPlaybackTime: x,
      playbackRate: this.nowPlaying.paused ? 0 : 1,
      playbackDuration: this.nowPlaying.duration
    });
  }

  formatTime(seconds): string {
    let sec = ((~~seconds) % 60).toString();
    if (sec.length === 1) {
      sec = '0' + sec;
    }
    return `${~~(seconds / 60)}:${sec}`
  }

  getMeta(url, isBuffer = false) {
    return new Promise((resolve, reject) => {
      jsmediatags.read(url, {
        onSuccess: (tag) => {
          let meta = {
            artist: tag.tags.artist ? tag.tags.artist : 'Unknown Artist',
            albumTitle: tag.tags.album ? tag.tags.album : 'Unknown Album',
            title: tag.tags.title ? tag.tags.title : (!isBuffer ? this.nowPlayingSong.title : this.bufferedSongInfo.title),
          };
          if (tag.tags.picture) {
            let uInt8Array = tag.tags.picture.data;
            let i = uInt8Array.length;
            let binaryString = new Array(i);
              while (i--) {
                binaryString[i] = String.fromCharCode(uInt8Array[i]);
              }
            let data = binaryString.join('');
            let base64 = 'data:image/png;base64,' + btoa(data);
            (<any>meta).artwork = base64;
          }
          if (isBuffer) {
            resolve(meta);
            return;
          } else {
            this.zone.run(() => {
              this.nowPlayingSongMeta = meta;
            });
          }
          resolve(meta);
        },
        onError: (error) => {
          let meta = {
            artist: 'Unknown Artist',
            albumTitle: 'Unknown Album',
            title: !isBuffer ? this.nowPlayingSong.title : this.bufferedSongInfo.title,
          }
          if (isBuffer) {
            resolve(meta);
            return;
          } else {
            this.nowPlayingSongMeta = meta;
          }
          resolve(meta);
        }
      });
    });

  }

  toggleRepeat() {
    if (this.repeatOne) {
      this.repeatOne = false;
    } else if (this.repeatAll) {
      this.repeatOne = true;
      this.repeatAll = false;
    } else {
      this.repeatAll = true;
    }
    localStorage.setItem('repeatOne', JSON.stringify(this.repeatOne));
    localStorage.setItem('repeatAll', JSON.stringify(this.repeatAll));
  }

  shareSong() {
    var options = {
      message: `${this.nowPlayingSongMeta.title} by ${this.nowPlayingSongMeta.artist}`, // not supported on some apps (Facebook, Instagram)
      subject: `${this.nowPlayingSongMeta.title} by ${this.nowPlayingSongMeta.artist}`, // fi. for email
      files: this.nowPlayingSongMeta.artwork ? [this.nowPlayingSongMeta.artwork] : [], // an array of filenames either locally or remotely
      url: this.nowPlayingSongUrl,
    }
    if (!(<any>window).cordova || !this.nowPlaying || !this.nowPlayingSongMeta.title) {
      console.log(options);
      return
    };

    var onSuccess = function(result) {
    }

    var onError = function(msg) {
    }

    plugins.socialsharing.shareWithOptions(options, onSuccess, onError);
  }

  setLockScreenInfo() {
    if (!this.nowPlayingSongMeta) return;
    let x = Object.assign({}, this.nowPlayingSongMeta);
    delete x.artwork;
    setTimeout(() => {
      setTimeout(() => {
        if (this.nowPlayingSongMeta.artwork) {
          NowPlaying.set({artwork: this.nowPlayingSongMeta.artwork});
        }
      }, 800)
      NowPlaying.set(Object.assign({
        playbackRate: this.nowPlaying.paused ? 0 : 1,
        elapsedPlaybackTime: this.nowPlaying.currentTime,
        playbackDuration: this.nowPlaying.duration
      }, x));
    }, 500);
  }

}
