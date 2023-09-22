<template>
    <div class="box">
        <div class="left">
            <el-form :inline="true" :model="formData" class="form-inline">
                <el-form-item label="摄像头">
                    <el-select v-model="formData.videoId" placeholder="选择摄像头" clearable>
                        <el-option v-for="(item, index) in localDevice.videoIn" :label="item.label" :value="item.deviceId"
                            :key="index" />
                    </el-select>
                </el-form-item>
                <el-form-item label="麦克风">
                    <el-select v-model="formData.videoIn" placeholder="选择麦克风" clearable>
                        <el-option v-for="(item, index) in localDevice.audioIn" :label="item.label" :value="item.deviceId"
                            :key="index" />
                    </el-select>
                </el-form-item>
                <el-form-item label="听筒">
                    <el-select v-model="formData.audioOutId" placeholder="选择听筒" clearable>
                        <el-option v-for="(item, index) in localDevice.audioOut" :label="item.label" :value="item.deviceId"
                            :key="index" />
                    </el-select>
                </el-form-item>
                <el-form-item label="分辨率:width">
                    <el-input v-model="formData.width" placeholder="输入分辨率:width" clearable />
                </el-form-item>
                <el-form-item label="分辨率:height">
                    <el-input v-model="formData.height" placeholder="输入分辨率:width" clearable />
                </el-form-item>
                <el-form-item label="FPS">
                    <el-input v-model="formData.frameRate" placeholder="输入FPS" clearable />
                </el-form-item>

                <el-form-item>
                    <el-button type="primary" @click="onSubmit">确认</el-button>
                </el-form-item>
            </el-form>
        </div>
        <div class="right">
            <video ref="refVideo" class="video" src="" controls autoplay muted></video>
        </div>
    </div>
</template>
<style lang="less" scoped>
.box {
    height: 100vh;
    display: flex;
    .left {
        flex: 1 1 auto;

        .form-inline {
            margin: 20px 0 0 20px;
        }
    }
    .right {
        flex: 0 0 600px;
        display: flex;
        justify-content: space-around;
        align-items: flex-start;
        margin-top: 100px;

        .video {
            width: 550px;
            height: 400px;
        }
    }
}
</style>

<script setup>
import { onMounted, reactive, ref } from 'vue'
const refVideo = ref()
const localDevice = reactive({
    audioIn: [],
    videoIn: [],
    audioOut: [],
})
const formData = reactive({
    videoId: undefined,
    audioInId: undefined,
    audioOutId: undefined,
    width: 1080,
    height: 720,
    frameRate: 24,
})

onMounted(() => {
    initInnerLocalDevice()
})


const onSubmit = async () => {
    const video = refVideo.value
    let stream = video.srcObject
    if (stream) {
        stream.getAudioTracks().forEach(e => {
            stream.removeTrack(e)
        })
        stream.getVideoTracks().forEach(e => {
            stream.removeTrack(e)
        })
    }
    const newStream = await getTargetDeviceMedia(formData.videoId, formData.audioId)
    video.srcObject = newStream
    video.muted = true
}
/**
 * 获取指定媒体设备id对应的媒体流
 * @param {*} videoId 
 * @param {*} audioId 
 */
const getTargetDeviceMedia = async (videoId, audioId) => {
    const constraints = {
        audio: {
            deviceId: audioId ? { exact: audioId } : undefined
        },
        video: {
            deviceId: videoId ? { exact: videoId } : undefined,
            width: formData.width,
            height: formData.height,
            frameRate: { ideal: formData.frameRate, max: 24 },//
        }
    }
    // if (window.stream) {
    //     window.stream.getTracks().forEach(track => {
    //         track.stop();
    //     });
    // }
    return await getLocalUserMedia(constraints).catch(handleError)
}
/**
 * 获取设备 stream
 * @param {*} constraints 
 * @returns {Promise<MediaStream>}
 */
const getLocalUserMedia = async (constraints) => {
    return await navigator.mediaDevices.getUserMedia(constraints)
}
/**
 * 获取用户设备上所有的摄像头和麦克风信息
 * 起关键作用的是enumerateDevices函数，在调用这个关键函数之前，getUserMedia函数使用户在访问服务时直接调用用户摄像头，
 * 此时如果用户授权且同意使用设备摄像头、麦克风，那么enumerateDevices函数就能获取设备信息了，在这里getUserMedia函数可以理解为获取摄像头或者麦克风权限集合的探路函数。
 */
const initInnerLocalDevice = () => {
    let constraints = { audio: true, video: true }
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.log('浏览器不支持获取媒体设备')
        return
    }
    navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
            stream.getTracks().forEach((trick) => {
                // 停止所有设备
                trick.stop()
            })
            navigator.mediaDevices
                .enumerateDevices()
                .then((devices) => {
                    devices.forEach((device) => {
                        const object = { deviceId: device.deviceId, kind: device.kind, label: device.label }
                        if (object.kind === 'audioinput') {
                            localDevice.audioIn.push(object)
                        }
                        if (object.kind === 'videoinput') {
                            localDevice.videoIn.push(object)
                        }
                        if (object.kind === 'audiooutput') {
                            localDevice.audioOut.push(object)
                        }
                    })
                })
                .catch(handleError)
        })
        .then(() => {
            console.log(localDevice)
        })
        .catch(handleError)
}

const handleError = (error) => {
    console.error('navigator.MediaDevices.getUserMedia error: ', error.message, error.name)
}
</script>
