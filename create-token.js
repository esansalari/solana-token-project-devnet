// File: create-token.js
import * as web3 from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import bs58 from 'bs58';
import * as mplTokenMetadata from '@metaplex-foundation/mpl-token-metadata';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Token details
const TOKEN_NAME = "ClickScore";
const TOKEN_SYMBOL = "CLS";
const TOKEN_DESCRIPTION = "ClickScore token on Solana devnet";
const TOKEN_DECIMALS = 9;
const TOKEN_AMOUNT = 10000000000000000000n; // 10 billion with 9 decimal places

function createKeypairFromSecretKey(secretKeyString) {
  console.log("Received secret key string length:", secretKeyString.length);
  
  let secretKey;
  try {
    secretKey = bs58.decode(secretKeyString);
    console.log("Successfully decoded as base58. Decoded length:", secretKey.length);
  } catch (e) {
    console.log("Failed to decode as base58, attempting JSON parse.");
    try {
      secretKey = Uint8Array.from(JSON.parse(secretKeyString));
      console.log("Successfully parsed as JSON. Array length:", secretKey.length);
    } catch (jsonError) {
      console.log("Failed to parse as JSON.");
      throw new Error("Invalid secret key format. Please provide a valid base58 string or JSON array.");
    }
  }

  if (secretKey.length !== 32 && secretKey.length !== 64) {
    console.log("Unexpected secret key length:", secretKey.length);
    throw new Error("Invalid secret key length. Expected 32 or 64 bytes.");
  }

  if (secretKey.length === 32) {
    console.log("Expanding 32-byte key to 64 bytes");
    const fullSecretKey = new Uint8Array(64);
    fullSecretKey.set(secretKey);
    secretKey = fullSecretKey;
  }

  return web3.Keypair.fromSecretKey(secretKey);
}

async function createToken(secretKeyString) {
  try {
    const fromWallet = createKeypairFromSecretKey(secretKeyString);
    console.log("Wallet public key:", fromWallet.publicKey.toBase58());

    const connection = new web3.Connection(web3.clusterApiUrl('devnet'), 'confirmed');
    console.log("Connected to devnet");

    console.log("Creating token mint...");
    const mint = await splToken.createMint(
      connection,
      fromWallet,
      fromWallet.publicKey,
      fromWallet.publicKey,
      TOKEN_DECIMALS
    );
    console.log("Token mint created:", mint.toBase58());

    console.log("Getting or creating token account...");
    const fromTokenAccount = await splToken.getOrCreateAssociatedTokenAccount(
      connection,
      fromWallet,
      mint,
      fromWallet.publicKey
    );
    console.log("Token account:", fromTokenAccount.address.toBase58());

    console.log("Minting tokens...");
    const signature = await splToken.mintTo(
      connection,
      fromWallet,
      mint,
      fromTokenAccount.address,
      fromWallet.publicKey,
      TOKEN_AMOUNT
    );
    console.log("Minting signature:", signature);

    console.log("Creating metadata...");
    const METADATA_PROGRAM_ID = new web3.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
    const metadataPDA = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      METADATA_PROGRAM_ID
    )[0];

    const tokenMetadata = {
      name: TOKEN_NAME,
      symbol: TOKEN_SYMBOL,
      uri: "https://raw.githubusercontent.com/your-username/your-repo/main/token-metadata.json",
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null
    };

    const instruction = mplTokenMetadata.createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPDA,
        mint: mint,
        mintAuthority: fromWallet.publicKey,
        payer: fromWallet.publicKey,
        updateAuthority: fromWallet.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: tokenMetadata,
          isMutable: true,
          collectionDetails: null
        }
      }
    );

    const transaction = new web3.Transaction().add(instruction);
    const metadataSignature = await web3.sendAndConfirmTransaction(connection, transaction, [fromWallet]);
    console.log("Metadata created:", metadataSignature);

    console.log('Token Mint Address:', mint.toBase58());
    console.log('Token Account Address:', fromTokenAccount.address.toBase58());

    const balance = await connection.getTokenAccountBalance(fromTokenAccount.address);
    console.log('Token Balance:', balance.value.uiAmount);

  } catch (error) {
    console.error("An error occurred:", error);
    if (error instanceof Error) {
      console.error("Error stack:", error.stack);
    }
  }
}

rl.question('Please enter your wallet secret key: ', (secretKey) => {
  createToken(secretKey.trim()).then(() => rl.close());
});