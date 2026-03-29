package com.shift.ballad.hikecore.callback

import com.shift.ballad.hikecore.model.AudioGuideResult

/**
 * Callback for asynchronous audio guide generation.
 *
 * Steps reported via [onProgress]: "fetching_pois", "generating_text", "generating_audio".
 */
interface GuideCallback {
    fun onProgress(step: String)
    fun onSuccess(result: AudioGuideResult)
    fun onError(error: Exception)
}
