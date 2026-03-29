package com.shift.ballad.hikecore

import java.nio.file.Files
import kotlin.io.path.createDirectories
import kotlin.io.path.writeText
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class CliSecretResolverTest {
    @Test
    fun `prefers shell env over local files`() {
        val projectDir = Files.createTempDirectory("cli-secret-resolver-env")
        projectDir.resolve(".env").writeText(
            """
            OPENAI_API_KEY=dotenv-openai
            MISTRAL_API_KEY=dotenv-mistral
            """.trimIndent(),
        )
        projectDir.resolve("local.properties").writeText(
            """
            OPENAI_API_KEY=properties-openai
            MISTRAL_API_KEY=properties-mistral
            """.trimIndent(),
        )

        val resolver = CliSecretResolver(
            env = mapOf(
                "OPENAI_API_KEY" to "env-openai",
                "MISTRAL_API_KEY" to "env-mistral",
            ),
            currentDirectory = projectDir,
        )

        assertEquals("env-openai", resolver.resolve("OPENAI_API_KEY", "openai_api_key"))
        assertEquals("env-mistral", resolver.resolve("MISTRAL_API_KEY", "mistral_api_key"))
    }

    @Test
    fun `loads keys from dot env in parent directory`() {
        val projectDir = Files.createTempDirectory("cli-secret-resolver-dotenv")
        val moduleDir = projectDir.resolve("hikecore").createDirectories()
        projectDir.resolve(".env").writeText(
            """
            OPENAI_API_KEY="dotenv-openai"
            export MISTRAL_API_KEY='dotenv-mistral'
            """.trimIndent(),
        )

        val resolver = CliSecretResolver(
            env = emptyMap(),
            currentDirectory = moduleDir,
        )

        assertEquals("dotenv-openai", resolver.resolve("OPENAI_API_KEY", "openai_api_key"))
        assertEquals("dotenv-mistral", resolver.resolve("MISTRAL_API_KEY", "mistral_api_key"))
    }

    @Test
    fun `falls back to local properties aliases`() {
        val projectDir = Files.createTempDirectory("cli-secret-resolver-properties")
        val moduleDir = projectDir.resolve("hikecore").createDirectories()
        projectDir.resolve("local.properties").writeText(
            """
            openai_api_key=properties-openai
            mistral_api_key=properties-mistral
            """.trimIndent(),
        )

        val resolver = CliSecretResolver(
            env = emptyMap(),
            currentDirectory = moduleDir,
        )

        assertEquals("properties-openai", resolver.resolve("OPENAI_API_KEY", "openai_api_key"))
        assertEquals("properties-mistral", resolver.resolve("MISTRAL_API_KEY", "mistral_api_key"))
    }

    @Test
    fun `returns null when no non blank secret is available`() {
        val projectDir = Files.createTempDirectory("cli-secret-resolver-missing")
        projectDir.resolve(".env").writeText(
            """
            OPENAI_API_KEY=
            MISTRAL_API_KEY=
            """.trimIndent(),
        )

        val resolver = CliSecretResolver(
            env = emptyMap(),
            currentDirectory = projectDir,
        )

        assertNull(resolver.resolve("OPENAI_API_KEY", "openai_api_key"))
        assertNull(resolver.resolve("MISTRAL_API_KEY", "mistral_api_key"))
    }
}
