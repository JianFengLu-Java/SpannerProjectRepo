import { markRaw, type Component } from 'vue'
import MyProfileCardSlot from './MyProfileCardSlot.vue'
import InAppBrowserSlot from './InAppBrowserSlot.vue'
import EditProfileSlot from './EditProfileSlot.vue'
import CloudDocEditorSlot from './CloudDocEditorSlot.vue'

export const sidebarSlotComponentMap: Record<string, Component> = {
	'profile-card': markRaw(MyProfileCardSlot),
	'in-app-browser': markRaw(InAppBrowserSlot),
	'edit-profile': markRaw(EditProfileSlot),
	'cloud-doc-editor': markRaw(CloudDocEditorSlot),
}
