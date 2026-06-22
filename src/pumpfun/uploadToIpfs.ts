
import fs from 'fs';
import { FleekSdk, PersonalAccessTokenService } from '@fleekxyz/sdk';
import dotenv from 'dotenv';
import metadata from './metadata';
dotenv.config();

const pat = process.env.PAT || '';
const project_id = process.env.PROJECT_ID || '';
const imageName = "./upload/bolt.jpg";
const metadataName = "./upload/metadata.json";

const patService = new PersonalAccessTokenService({
  personalAccessToken: pat,
  projectId: project_id,
})

const fleekSdk = new FleekSdk({ accessTokenService: patService })

async function uploadFileToIPFS(filename: string, content: Buffer) {
  // Convert Buffer to ArrayBuffer for SDK compatibility
  // Buffer extends Uint8Array, so we create a new Uint8Array and get its buffer
  // This ensures we get a regular ArrayBuffer (not SharedArrayBuffer)
  const uint8Array = new Uint8Array(content);
  const arrayBuffer = uint8Array.buffer.slice(
    uint8Array.byteOffset,
    uint8Array.byteOffset + uint8Array.byteLength
  ) as ArrayBuffer;
  const result = await fleekSdk.ipfs().add({
    path: filename,
    content: arrayBuffer
  });
  return result;
}

export const getUploadedMetadataURI = async (): Promise<string> => {
  const fileContent = fs.readFileSync(imageName);

  try {
    const imageUploadResult = await uploadFileToIPFS(imageName, fileContent);
    console.log('Image uploaded to IPFS:', imageUploadResult);
    console.log('IPFS URL:', `https://cf-ipfs.com/ipfs/${imageUploadResult.cid}`);

    const data = {
      "name": metadata.name,
      "symbol": metadata.symbol,
      "description": metadata.description,
      "image": `https://cf-ipfs.com/ipfs/${imageUploadResult.cid}`,
      "showName": metadata.showName,
      "createdOn": metadata.createdOn,
      "twitter": metadata.twitter,
      "telegram": metadata.telegram,
      "website": metadata.website
    }
    const metadataString = JSON.stringify(data);
    const bufferContent = Buffer.from(metadataString, 'utf-8');
    fs.writeFileSync(metadataName, bufferContent);
    const metadataContent = fs.readFileSync(metadataName);

    const metadataUploadResult = await uploadFileToIPFS(metadataName, metadataContent);
    console.log('File uploaded to IPFS:', metadataUploadResult);
    console.log('IPFS URL:', `https://cf-ipfs.com/ipfs/${metadataUploadResult.cid}`)
    return `https://cf-ipfs.com/ipfs/${metadataUploadResult.cid}`;
  } catch (error) {
    return "";
  }
}