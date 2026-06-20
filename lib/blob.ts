import { BlobServiceClient, ContainerClient } from '@azure/storage-blob'
import fs from 'fs'
import path from 'path'

const CONTAINER = 'didi-scheduler'
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data')

function isLocal(): boolean {
  return !process.env.AZURE_STORAGE_CONNECTION_STRING
}

function localPath(blobName: string): string {
  if (!fs.existsSync(LOCAL_DATA_DIR)) fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true })
  return path.join(LOCAL_DATA_DIR, blobName)
}

function getContainer(): ContainerClient {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING!
  const client = BlobServiceClient.fromConnectionString(connStr)
  return client.getContainerClient(CONTAINER)
}

export async function readBlob<T>(blobName: string, fallback: T): Promise<T> {
  if (isLocal()) {
    try {
      const p = localPath(blobName)
      if (!fs.existsSync(p)) return fallback
      return JSON.parse(fs.readFileSync(p, 'utf-8')) as T
    } catch {
      return fallback
    }
  }
  try {
    const container = getContainer()
    const blob = container.getBlobClient(blobName)
    if (!(await blob.exists())) return fallback
    const download = await blob.download()
    const chunks: Buffer[] = []
    for await (const chunk of download.readableStreamBody as AsyncIterable<Buffer>) {
      chunks.push(chunk)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf-8')) as T
  } catch {
    return fallback
  }
}

export async function writeBlob<T>(blobName: string, data: T): Promise<void> {
  const content = JSON.stringify(data, null, 2)
  if (isLocal()) {
    fs.writeFileSync(localPath(blobName), content, 'utf-8')
    return
  }
  const container = getContainer()
  await container.createIfNotExists()
  const blob = container.getBlockBlobClient(blobName)
  await blob.upload(content, Buffer.byteLength(content), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
  })
}

export function lessonsBlobName(yearMonth: string) {
  return `lessons-${yearMonth}.json`
}
