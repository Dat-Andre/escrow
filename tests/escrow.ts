import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { Account, ASSOCIATED_TOKEN_PROGRAM_ID, createMint, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { assert } from "chai";
import { BN } from "bn.js";

const confirmTx = async (signature: string) => {
  const latestBlockhash = await anchor.getProvider().connection.getLatestBlockhash();
  await anchor.getProvider().connection.confirmTransaction(
    {
      signature,
      ...latestBlockhash,
    },
    'confirmed'
  )
  return signature
}


describe("fully test escrow", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Escrow as Program<Escrow>;

  const UNITS_PER_TOKEN = 1_000_000;

  const user_a = Keypair.generate();
  const user_b = Keypair.generate();
  const user_refund = Keypair.generate();
  let ataA_userRefund: Account = null;
  let mintA: PublicKey = null;
  let mintB: PublicKey = null;
  let ataA_userA: Account = null;
  let ataB_userA: PublicKey = null;
  let ataA_userB: PublicKey = null;
  let ataB_userB: Account = null;
  const escrow = PublicKey.findProgramAddressSync([
    Buffer.from("escrow"), 
    user_a.publicKey.toBytes(), 
    new BN(1).toArrayLike(Buffer, "le", 8)
  ], program.programId)[0];  
  let escrowVault: PublicKey = null;
  const escrowRefund = PublicKey.findProgramAddressSync([
    Buffer.from("escrow"), 
    user_refund.publicKey.toBytes(), 
    new BN(2).toArrayLike(Buffer, "le", 8)
  ], program.programId)[0];  
  let escrowVaultRefund: PublicKey = null;
  


  // set up 2 new tokens
  // transfer tokens to accounts
  //initialize escrow
  // etc
  it("set users with sol", async () => {

    const airdropTxA = await anchor.getProvider().connection.requestAirdrop(user_a.publicKey, 2 * LAMPORTS_PER_SOL).then(confirmTx);
    console.log("airdrop tx signature to user A", airdropTxA);
    const airdropTxB = await anchor.getProvider().connection.requestAirdrop(user_b.publicKey, 2 * LAMPORTS_PER_SOL).then(confirmTx);
    console.log("airdrop tx signature to user A", airdropTxB);

    const airdropTxRefund = await anchor.getProvider().connection.requestAirdrop(user_refund.publicKey, 2 * LAMPORTS_PER_SOL).then(confirmTx);
    console.log("airdrop tx signature to user A", airdropTxRefund);


    const balanceA = await anchor.getProvider().connection.getBalance(user_a.publicKey);
    console.log("balance user A: ", balanceA);
    const balanceB = await anchor.getProvider().connection.getBalance(user_b.publicKey);
    console.log("balance user B: ", balanceB);
    const balanceRefund = await anchor.getProvider().connection.getBalance(user_refund.publicKey);
    console.log("balance user Refund: ", balanceRefund);
  })

  it("create token A and send some to user A", async () => {
    
    mintA =  await createMint(anchor.getProvider().connection, user_a,user_a.publicKey,null, 6);

    escrowVault= getAssociatedTokenAddressSync(mintA,escrow, true);
    escrowVaultRefund= getAssociatedTokenAddressSync(mintA,escrowRefund, true);
    ataA_userB = getAssociatedTokenAddressSync(mintA, user_b.publicKey);

    console.log("mintA: ", mintA);
    assert.ok(mintA, "mintA is not null");
    //mintA = resp.publicKey;
    ataA_userA = await getOrCreateAssociatedTokenAccount(anchor.getProvider().connection, user_a, mintA, user_a.publicKey);
    console.log(`user A ata for mintA is: ${ataA_userA.address.toBase58()}`);
    assert.ok(ataA_userA, "ata is not null");

    const mint_mintA_to_userA = await mintTo(anchor.getProvider().connection, user_a, mintA, ataA_userA.address, user_a.publicKey, 10 * UNITS_PER_TOKEN);
    const destBalance = await anchor.getProvider().connection.getTokenAccountBalance(ataA_userA.address);
    console.log(`Your balance is: ${destBalance.value.uiAmount}`);
    assert.equal(destBalance.value.amount, (10 * UNITS_PER_TOKEN).toString(), "mint token failed");

    // mint some A to user refund
    ataA_userRefund = await getOrCreateAssociatedTokenAccount(anchor.getProvider().connection, user_refund, mintA, user_refund.publicKey);
    const mint_mintA_to_userRefund = await mintTo(anchor.getProvider().connection, user_a, mintA, ataA_userRefund.address, user_a.publicKey, 5 * UNITS_PER_TOKEN);
    const refundBalance = await anchor.getProvider().connection.getTokenAccountBalance(ataA_userRefund.address);
    console.log(`Your balance is: ${refundBalance.value.uiAmount}`);
    assert.equal(refundBalance.value.amount, (5 * UNITS_PER_TOKEN).toString(), "mint token failed");
  })

  it("create token B and send some to user B", async () => {
    
    mintB =  await createMint(anchor.getProvider().connection, user_b,user_b.publicKey,null, 6);

    ataB_userA = getAssociatedTokenAddressSync(mintB, user_a.publicKey);

    console.log("mintB: ", mintB);
    assert.ok(mintB, "mintB is not null");
    //mintA = resp.publicKey;
    ataB_userB = await getOrCreateAssociatedTokenAccount(anchor.getProvider().connection, user_b, mintB, user_b.publicKey);
    console.log(`user B ata for mintB is: ${ataB_userB.address.toBase58()}`);
    assert.ok(ataB_userB, "ata is not null");

    const mint_mintB_to_userB = await mintTo(anchor.getProvider().connection, user_b, mintB, ataB_userB.address, user_b.publicKey, 5 * UNITS_PER_TOKEN);
    const destBalance = await anchor.getProvider().connection.getTokenAccountBalance(ataB_userB.address);
    console.log(`Your balance is: ${destBalance.value.uiAmount}`);
    assert.equal(destBalance.value.amount, (5 * UNITS_PER_TOKEN).toString(), "mint token failed");

  })

  it("Make escrow", async () => {  
    
  const tx = await program.methods.make(new BN(1),new BN(5 * UNITS_PER_TOKEN) ,new BN(2 * UNITS_PER_TOKEN)).accountsPartial({
    maker: user_a.publicKey,
    mintA: mintA,
    mintB: mintB,
    makerAtaA: ataA_userA.address,
    escrow: escrow,
    vault: escrowVault,
    tokenProgram: TOKEN_PROGRAM_ID
  }).signers([user_a]).rpc().then(confirmTx);
  console.log("Your transaction signature", tx);

  const balance = await anchor.getProvider().connection.getTokenAccountBalance(escrowVault);
  console.log(`vault balance is: ${balance.value.uiAmount}`);
  assert.equal(balance.value.amount, (5 * UNITS_PER_TOKEN).toString(), "escrow make failed");

  });


  it("Take escrow", async () => {  
    
    const tx = await program.methods.take().accountsPartial({
      taker: user_b.publicKey,
      maker: user_a.publicKey,
      mintA: mintA,
      mintB: mintB,
      takerAtaA: getAssociatedTokenAddressSync(mintA, user_b.publicKey),
      takerAtaB: ataB_userB.address,
      makerAtaB: getAssociatedTokenAddressSync(mintB,user_a.publicKey),
      escrow: escrow,
      vault: escrowVault,
      tokenProgram: TOKEN_PROGRAM_ID
    }).signers([user_b]).rpc().then(confirmTx);
    console.log("Your transaction signature", tx);
  
    const balanceA_UserB = await anchor.getProvider().connection.getTokenAccountBalance(ataA_userB);
    console.log(`vault balance is: ${balanceA_UserB.value.uiAmount}`);
    assert.equal(balanceA_UserB.value.amount, (5 * UNITS_PER_TOKEN).toString(), "escrow take failed");

    const balanceB_UserA = await anchor.getProvider().connection.getTokenAccountBalance(ataB_userA);
    console.log(`vault balance is: ${balanceB_UserA.value.uiAmount}`);
    assert.equal(balanceB_UserA.value.amount, (2 * UNITS_PER_TOKEN).toString(), "escrow take failed");
  
    });

    it("Make new escrow", async () => {  
    
      const tx = await program.methods.make(new BN(2),new BN(2 * UNITS_PER_TOKEN) ,new BN(2 * UNITS_PER_TOKEN)).accountsPartial({
        maker: user_refund.publicKey,
        mintA: mintA,
        mintB: mintB,
        makerAtaA: ataA_userRefund.address,
        escrow: escrowRefund,
        vault: escrowVaultRefund,
        tokenProgram: TOKEN_PROGRAM_ID
      }).signers([user_refund]).rpc().then(confirmTx);
      console.log("Your transaction signature", tx);
    
      const balanceVault = await anchor.getProvider().connection.getTokenAccountBalance(escrowVaultRefund);
      console.log(`vault balance is: ${balanceVault.value.uiAmount}`);
      assert.equal(balanceVault.value.amount, (2 * UNITS_PER_TOKEN).toString(), "escrow make failed");

      const balanceUserRefund = await anchor.getProvider().connection.getTokenAccountBalance(ataA_userRefund.address);
      console.log(`user Refund balance is: ${balanceUserRefund.value.uiAmount}`);
      assert.equal(balanceUserRefund.value.amount, (3 * UNITS_PER_TOKEN).toString(), "escrow make failed");
    
      });

      it("Refund escrow", async () => {
        
        const tx = await program.methods.refund().accountsPartial({
          maker: user_refund.publicKey,
          mintA: mintA,
          makerAtaA: ataA_userRefund.address,
          escrow: escrowRefund,
          vault: escrowVaultRefund,
          tokenProgram: TOKEN_PROGRAM_ID
        }).signers([user_refund]).rpc().then(confirmTx);


        const balanceUserRefund = await anchor.getProvider().connection.getTokenAccountBalance(ataA_userRefund.address);
        console.log(`user Refund balance is: ${balanceUserRefund.value.uiAmount}`);
        assert.equal(balanceUserRefund.value.amount, (5 * UNITS_PER_TOKEN).toString(), "escrow refund failed");

      });
});
