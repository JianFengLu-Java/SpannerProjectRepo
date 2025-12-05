import {defineStore} from 'pinia'

export const useUserInfo = defineStore("userInfo",{
    state:()=>({
        userName:'',
        sex:'',
        email:'',
        avtarUrl:'',
        userAccoutNum:''
    }),
    actions: {
        setUserName(newUserName){
            this.userName = newUserName
        },
        setSex(newSex){
            this.userName = newSex
        },
        setUserAccountNum(newUserAccountNum){
            this.userName = newUserAccountNum
        },
    }
}) 