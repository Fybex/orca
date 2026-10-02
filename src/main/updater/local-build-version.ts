// `<base>-local.<timestamp>.<commit>`, or `.local.` after a prerelease base; see build-mac-local.mjs.
const LOCAL_BUILD_VERSION_SUFFIX = /[-.]local\.\d+\.[0-9A-Za-z-]+$/

/** A locally built fork is not on the release feed; background checks would offer upstream over it. */
export function isLocalBuildVersion(version: string): boolean {
  return LOCAL_BUILD_VERSION_SUFFIX.test(version)
}
