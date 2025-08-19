<script setup>
import { ref, onMounted } from 'vue'
import { SkyWayContext, SkyWayRoom, SkyWayStreamFactory, uuidV4 } from '@skyway-sdk/room'
//import  GetToken  from './SkywayToken.js'
// ↓ 追加: 直接秘密鍵を使う代わりに Edge Function 経由
import { getSkyWayToken } from '../services/skywayToken.js'

// SkyWayの実体とルームの実体を保管するため
const context = { ctx: null, room: null }
let member = null // 自分の member

// 現在のURL
const baseUrl = window.location.href.split('?')[0]
// div ref="stream-area"参考
const StreamArea = ref(null)
// 会議部屋を作ったかどうか
const RoomCreated = ref(false)
// ルームのIDの保管、シェアため
const RoomId = ref(null)

// (Step3 用) 新規 publication 重複購読防止セット
const subscribed = new Set()

// SkyWayのAPIと繋がって実体を保管する
async function getContext() {
  if (context.ctx) return context.ctx
  const roomNameForFirstToken = RoomId.value || 'placeholder'
  const { token } = await getSkyWayToken(roomNameForFirstToken)
  context.ctx = await SkyWayContext.Create(token)

  // トークン更新時: 再度 Edge Function から新しい token を取得
  context.ctx.onTokenUpdateReminder.add(async () => {
    try {
      const rn = RoomId.value || roomNameForFirstToken
      const { token: newToken } = await getSkyWayToken(rn)
      await context.ctx.updateAuthToken(newToken)
    } catch (e) {
      console.error('token refresh failed', e)
    }
  })
  return context.ctx
}

// 部屋を作り、ルームIDを保管する
async function createRoom() {
  // 追加: context が無ければ初期化
  await getContext()
  // ルームIDがない場合は作成する
  if (!RoomId.value) {
    RoomId.value = uuidV4()
  }

  // ルームの実体を作成する, (SFU)に変更
  // FindOrCreateは同じ名前のルームがある場合はそれを使う
  context.room = await SkyWayRoom.FindOrCreate(context.ctx, {
    type: 'sfu',
    name: RoomId.value
  })
  // ルームを作ったことを示すため
  RoomCreated.value = true

  // 新規 publication イベント購読初期化
  setupRoomEvents()
}

// 部屋に入る関数
async function joinRoom() {
  if (!RoomId.value) {
    alert('No Room ID')
    return
  }
  // ルームの実体がない場合は作成する
  if (!RoomCreated.value) {
    await createRoom()
  } else {
    await getContext()
    setupRoomEvents() // 念のため
  }

  // ルームに入る, 今は名前はランダム
  member = await context.room.join({ name: uuidV4() })

  // Camera + Microphone の LocalStream を作成する
  const { audio, video } = await SkyWayStreamFactory.createMicrophoneAudioAndCameraStream()

  // 正しい publish（LocalStream オブジェクト）を 1 回ずつ
  await member.publish(audio)
  await member.publish(video)

  // ローカル映像を表示する
  const videoEl = document.createElement('video')
  videoEl.autoplay = true
  videoEl.playsInline = true
  videoEl.muted = true  // 自分の声がループしないように
  videoEl.style.width = '100%'
  videoEl.style.height = '100%'
  video.attach(videoEl)
  StreamArea.value.appendChild(videoEl)
  await videoEl.play()

  // ====== 既存 publication を subscribe (自分以外) ======
  for (const pub of context.room.publications) {
    if (pub.publisher.id === member.id) continue
    await subscribeIfNeeded(pub)
  }
}

// ====== 新規 publication 自動購読 (onStreamPublished) ======
let roomEventsBound = false
function setupRoomEvents() {
  if (roomEventsBound || !context.room) return
  roomEventsBound = true

  context.room.onStreamPublished.add(async (e) => {
    await subscribeIfNeeded(e.publication)
  })

  context.room.onStreamUnpublished.add((e) => {
    subscribed.delete(e.publication.id)
    // （簡易）要素削除は省略。実装する場合は dataset に publication.id を保存して対応
  })
}

// 重複購読防止付き subscribe
async function subscribeIfNeeded(pub) {
  if (!member) return
  if (pub.publisher.id === member.id) return
  if (subscribed.has(pub.id)) return
  try {
    const { stream } = await member.subscribe(pub.id)
    subscribed.add(pub.id)
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

// ページが読み込まれたら SkyWayの実体を作成する
onMounted(async () => {
  // 順序変更: 先に URL から RoomId 読み取り
  RoomId.value = new URLSearchParams(window.location.search).get('room')
  await getContext()
})
</script>

<template>
  <h1>Kaigi</h1>

  <div class="card">
    <div ref="StreamArea" v-if="RoomCreated"></div>

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
