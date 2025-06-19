import { execSync } from 'child_process'

/**
 * Deletes a Temporal namespace using the CLI
 * Based on the successful pattern from cleanup-temporal-namespaces.sh
 */
export async function deleteTemporalNamespace(namespace: string): Promise<boolean> {
  const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233'
  const isSecure = temporalAddress.includes(':443') || temporalAddress.startsWith('https://')
  
  try {
    // Build command based on what works in the script
    let cmd = `temporal operator namespace delete --namespace="${namespace}" --address="${temporalAddress}" --yes`
    
    // Add TLS flag if secure (as shown in the script)
    if (isSecure) {
      cmd += ' --tls'
    }
    
    // Execute the command and capture output
    const output = execSync(cmd, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 10000,
    })
    
    // Check if deletion was successful
    if (output.includes('has been deleted') || output.includes('successfully deleted')) {
      console.log(`✓ Successfully deleted namespace: ${namespace}`)
      return true
    }
    
    // If no success message, but no error thrown, assume it worked
    console.log(`✓ Namespace deletion completed: ${namespace}`)
    return true
  } catch (error: any) {
    // Check for common non-error conditions
    if (error.message?.includes('Namespace not found') || 
        error.message?.includes('namespace not found') ||
        error.stderr?.includes('Namespace not found') ||
        error.stderr?.includes('namespace not found')) {
      // Namespace already gone, this is success
      console.log(`✓ Namespace already deleted: ${namespace}`)
      return true
    }
    
    // Log actual errors
    console.warn(`✗ Failed to delete namespace ${namespace}: ${error.message || error}`)
    return false
  }
}

/**
 * Lists all Temporal namespaces matching a prefix
 */
export async function listTemporalNamespaces(prefix: string): Promise<string[]> {
  const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233'
  const isSecure = temporalAddress.includes(':443') || temporalAddress.startsWith('https://')
  
  try {
    let cmd = `temporal operator namespace list --address="${temporalAddress}"`
    
    if (isSecure) {
      cmd += ' --tls'
    }
    
    const output = execSync(cmd, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 10000,
    })
    
    // Parse namespaces from output
    const namespaces: string[] = []
    const lines = output.split('\n')
    
    for (const line of lines) {
      if (line.includes('NamespaceInfo.Name') && line.includes(prefix)) {
        const match = line.match(/NamespaceInfo\.Name\s+(\S+)/)
        if (match && match[1]) {
          namespaces.push(match[1])
        }
      }
    }
    
    return namespaces
  } catch (error: any) {
    console.warn(`Failed to list namespaces: ${error.message}`)
    return []
  }
}

/**
 * Cleans up test namespaces with a given prefix or exact namespace name
 */
export async function cleanupTestNamespaces(prefixOrNamespace: string): Promise<void> {
  // If it looks like a complete namespace name (contains enterprise ID pattern),
  // clean up just that specific namespace
  if (prefixOrNamespace.includes('-') && prefixOrNamespace.length > 10) {
    console.log(`Cleaning up specific namespace: ${prefixOrNamespace}`)
    if (await deleteTemporalNamespace(prefixOrNamespace)) {
      console.log(`✅ Successfully cleaned up namespace: ${prefixOrNamespace}`)
    } else {
      console.log(`⚠️  Could not clean up namespace: ${prefixOrNamespace}`)
    }
    return
  }
  
  // Otherwise, treat as prefix and clean up all matching namespaces
  const namespaces = await listTemporalNamespaces(prefixOrNamespace)
  
  if (namespaces.length === 0) {
    console.log(`No namespaces found with prefix '${prefixOrNamespace}'`)
    return
  }
  
  console.log(`Found ${namespaces.length} namespace(s) to clean up:`)
  namespaces.forEach(ns => console.log(`  - ${ns}`))
  
  let successCount = 0
  for (const namespace of namespaces) {
    if (await deleteTemporalNamespace(namespace)) {
      successCount++
    }
  }
  
  console.log(`Cleanup complete: ${successCount}/${namespaces.length} namespaces deleted`)
}