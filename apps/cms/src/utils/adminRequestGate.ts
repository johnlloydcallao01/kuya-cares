const MAX_CONCURRENT_ADMIN_REQUESTS = 2

let activeRequests = 0
const waiters: Array<() => void> = []

async function acquire(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_ADMIN_REQUESTS) {
    activeRequests += 1
    return
  }

  await new Promise<void>((resolve) => waiters.push(resolve))
  activeRequests += 1
}

function release(): void {
  activeRequests -= 1
  waiters.shift()?.()
}

export async function withAdminRequestSlot<T>(work: () => Promise<T>): Promise<T> {
  await acquire()
  try {
    return await work()
  } finally {
    release()
  }
}