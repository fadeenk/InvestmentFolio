interface FileSystemFileHandle {
  name: string
  kind: 'file'
  getFile(): Promise<File>
  queryPermission(descriptor?: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>
  requestPermission(descriptor?: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>
  createWritable(): Promise<FileSystemWritableFileStream>
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: ArrayBuffer | ArrayBufferView | Blob | string): Promise<void>
  close(): Promise<void>
}

interface Window {
  showOpenFilePicker(options?: {
    multiple?: boolean
    types?: Array<{
      description?: string
      accept: Record<string, string[]>
    }>
  }): Promise<FileSystemFileHandle[]>
  showSaveFilePicker(options?: {
    suggestedName?: string
    types?: Array<{
      description?: string
      accept: Record<string, string[]>
    }>
  }): Promise<FileSystemFileHandle>
}
