// Minimal ambient declarations for the File System Access API.
// TypeScript's lib.dom.d.ts doesn't yet include these types.

interface FileSystemPermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemDirectoryHandle {
  queryPermission(descriptor: FileSystemPermissionDescriptor): Promise<PermissionState>
  requestPermission(descriptor: FileSystemPermissionDescriptor): Promise<PermissionState>
}

interface ShowDirectoryPickerOptions {
  id?: string
  mode?: 'read' | 'readwrite'
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | FileSystemHandle
}

interface Window {
  showDirectoryPicker(options?: ShowDirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
}
