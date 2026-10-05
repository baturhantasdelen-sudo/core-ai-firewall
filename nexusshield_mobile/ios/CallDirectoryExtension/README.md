# iOS Call Directory Extension

1. Open `ios/Runner.xcworkspace` in Xcode.
2. **File → New → Target → Call Directory Extension** (name: `CallDirectoryExtension`).
3. Replace generated `CallDirectoryHandler.swift` with the copy in this folder.
4. Enable App Group `group.com.nexusshield.guard` on Runner and the extension; sync blocked numbers from Flutter via shared UserDefaults (future bridge).

Until the extension target is added, Android Call Screening carries the primary block list; iOS sync writes to standard UserDefaults for development.
