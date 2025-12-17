import {defineStore} from 'pinia'

export const useUserInfo = defineStore("userInfo",{
    state:()=>({
        userName:'',
        sex:'',
        email:'',
        avtarUrl:'',
        userAccoutNum:''
    })
}) 