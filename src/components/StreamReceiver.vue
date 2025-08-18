<script setup>
import { ref, onMounted } from 'vue'
import { SkyWayContext, SkyWayRoom, SkyWayStreamFactory, uuidV4 } from '@skyway-sdk/room';
import  GetToken  from './SkywayToken.js'

// SkyWayのトークンを作成する
const tokenString = GetToken(import.meta.env.VITE_SKYWAY_APP_ID, import.meta.env.VITE_SKYWAY_SECRET_KEY);

// SkyWayの実体とルームの実体を保管するため
const context = {'ctx': null, 'room': null};
let member = null // 自分の member

// 現在のURL
const baseUrl = window.location.href.split('?')[0];
// div ref="stream-area"参考
const StreamArea = ref(null)
// 会議部屋を作ったかどうか
const RoomCreated = ref(false)
// ルームのIDの保管、シェアため
const RoomId = ref(null)


// SkyWayのAPIと繋がって実体を保管する
const getContext = async () => {
    context.ctx = await SkyWayContext.Create(tokenString);

    // トークンの更新
    context.ctx.onTokenUpdateReminder.add(() => {
        context.ctx.updateAuthToken(tokenString);
    });
    return context.ctx;
}

// 部屋を作り、ルームIDを保管する
const createRoom = async () => {
    // ルームIDがない場合は作成する
    if (!RoomId.value) {
        RoomId.value = uuidV4();
    }

    // ルームの実体を作成する, (SFU)に変更
    // FindOrCreateは同じ名前のルームがある場合はそれを使う
    context.room = await SkyWayRoom.FindOrCreate(context.ctx, {
        type: 'sfu',
        name: RoomId.value,
    });
    // ルームを作ったことを示すため
    RoomCreated.value = true
}

// 部屋に入る関数
const joinRoom = async () => {
    if (!RoomId.value) {
        alert ('No Room ID');
        return;
    }

    // ルームの実体がない場合は作成する
    if (!RoomCreated.value) {
        await createRoom();
    }

    // ルームに入る, 今は名前はランダム、同じ名前だと入らないので、現在テストため
    const member = await context.room.join({name: uuidV4()});
    // Cameraのストリームを作成する
    //const videoStream = await SkyWayStreamFactory.createCameraVideoStream();

    // 映像を送る
    //await member.publish(videoStream);

    // ユーザーからCameraの映像を取得する
    const { audio, video } = await SkyWayStreamFactory.createMicrophoneAudioAndCameraStream()

   // 正しい publish（MediaStream ではなく LocalStream オブジェクト）
    await member.publish(audio)
    await member.publish(video)
    // 映像を表示する
    const videoEl = document.createElement('video')
    //videoEl.srcObject = video;
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.muted = true;  // 自分の声がループしないように
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    StreamArea.value.appendChild(videoEl);

   // LocalVideoStream の attach を使う
    video.attach(videoEl);

    StreamArea.value.appendChild(videoEl);
    // 映像を再生する
    await videoEl.play();

// ====== ここがステップ2：既存 publication を subscribe ====== (Joinroomないで行う)
    for (const pub of context.room.publications) {
    // 自分自身の publication は無視
    if (pub.publisher.id === member.id) continue
    try {
        const { stream } = await member.subscribe(pub.id)
        if (stream.track.kind === 'video') {
        const remoteVideo = document.createElement('video')
        remoteVideo.autoplay = true
        remoteVideo.playsInline = true
        stream.attach(remoteVideo)
        StreamArea.value.appendChild(remoteVideo)
        } else if (stream.track.kind === 'audio') {
        const remoteAudio = document.createElement('audio')
        remoteAudio.autoplay = true
        stream.attach(remoteAudio)
        StreamArea.value.appendChild(remoteAudio)
        }
    } catch (e) {
        console.error('subscribe 失敗', pub, e)
    }
    }
}
// ページが読み込まれたら SkyWayの実体を作成する
onMounted(async () => {
    await getContext();

    // URLでルームIDがある場合はそれを使う
    RoomId.value = new URLSearchParams(window.location.search).get('room');
});

</script>

<template>
  <h1>Kaigi</h1>

  <div class="card">
    <div ref="StreamArea" v-if="RoomCreated">
        
    </div>
    <div v-else>
    
      <button @click="createRoom">Create Room</button>

        
    </div>
    <div v-if="RoomId">
        <p>以下のURLは相手とシェア:</p>
        <p>{{ baseUrl }}?room={{ RoomId }}</p>

        <p>またはルームIDを送りましょう:</p>
        <p>{{ RoomId }}</p>

        <p>会議を開始するため以下のボタンをクリックしてください:</p>
        <button @click="joinRoom">Join Room</button>

    </div>
  </div>
</template>
