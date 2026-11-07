package com.spotifree.music;

import androidx.core.content.FileProvider;

/**
 * Hands the images made by the app (stories cards) to other apps when sharing.
 * Its own authority ("${applicationId}.share") and paths (res/xml/spotifree_share_paths.xml):
 * only the app's cache/share folder.
 */
public class SpotifreeShareProvider extends FileProvider {
}
